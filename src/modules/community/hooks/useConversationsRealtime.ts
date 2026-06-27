"use client";

import { useEffect, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

// DM temps réel via Broadcast from Database (mig. 047) — remplace l'abonnement
// table-wide postgres_changes de la mig. 039.
//
// Pourquoi ce changement
// ----------------------
// postgres_changes obligeait CHAQUE client à écouter TOUTE la table messages, la
// RLS filtrant la livraison côté serveur → fan-out O(users connectés) par message
// (mode d'échec connu à l'échelle). Ici, un trigger DB diffuse chaque message sur
// un canal PRIVÉ propre à sa conversation (`conv:<id>`). Le client ne s'abonne
// qu'aux canaux de SES conversations → fan-out O(participants) = 2.
//
// Deux types de canaux privés (Realtime Authorization, RLS sur realtime.messages) :
//   - `conv:<conversationId>` : reçoit les nouveaux messages d'une conversation.
//   - `dm-user:<currentUserId>` : reçoit la création d'une nouvelle conversation
//     (un premier message d'un inconnu : on n'est pas encore abonné à son canal
//     conv, donc le serveur nous prévient via notre canal user pour qu'on la charge).
//
// Les canaux privés exigent un token : on appelle supabase.realtime.setAuth()
// avant de souscrire, et on le ré-applique au refresh de session (TOKEN_REFRESHED)
// pour ne pas perdre la livraison après expiration (~1 h).

export function useConversationsRealtime(
  currentUserId: string,
  conversationIds: string[],
  onIncomingMessage: (conversationId: string) => void,
  onNewConversation: (conversationId: string) => void,
): void {
  // Callbacks lus via refs → l'abonnement ne se relance pas quand le parent
  // re-render et passe de nouvelles références de fonction.
  const onIncomingRef = useRef(onIncomingMessage);
  const onNewConvRef = useRef(onNewConversation);
  useEffect(() => {
    onIncomingRef.current = onIncomingMessage;
    onNewConvRef.current = onNewConversation;
  }, [onIncomingMessage, onNewConversation]);

  // Clé valeur-stable du SET de conversations : ne change que si l'ensemble des
  // ids change (pas à chaque nouveau message, qui ne fait que muter lastMessageAt).
  const idsKey = useMemo(
    () => [...conversationIds].sort().join(","),
    [conversationIds],
  );
  // Miroir des ids, mis à jour en effet (jamais pendant le render — règle
  // react-hooks/refs du repo), lu par l'effet d'abonnement via la clé.
  const idsRef = useRef(conversationIds);
  useEffect(() => {
    idsRef.current = conversationIds;
  }, [conversationIds]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createSupabaseBrowserClient();

    // Coalescing local 300 ms (dédupliqué par conversation_id) : un burst de
    // messages → un seul appel du callback par conversation.
    const pending = new Set<string>();
    let timer: number | null = null;
    const flush = () => {
      timer = null;
      const ids = Array.from(pending);
      pending.clear();
      for (const id of ids) onIncomingRef.current(id);
    };
    const schedule = (conversationId: string) => {
      pending.add(conversationId);
      if (timer) return;
      timer = window.setTimeout(flush, 300);
    };

    let cancelled = false;
    let channels: RealtimeChannel[] = [];
    let authSub: { unsubscribe: () => void } | null = null;

    (async () => {
      // Token requis pour les canaux privés (RLS realtime.messages).
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
      if (cancelled) return;

      // Ré-applique le token au refresh de session, sinon les canaux privés
      // cessent silencieusement de recevoir après expiration (~1 h).
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "TOKEN_REFRESHED" && session?.access_token) {
          void supabase.realtime.setAuth(session.access_token);
        }
      });
      authSub = sub.subscription;

      const ids = idsRef.current;

      // 1. Un canal privé par conversation → nouveaux messages.
      for (const convId of ids) {
        const ch = supabase
          .channel(`conv:${convId}`, { config: { private: true } })
          .on("broadcast", { event: "INSERT" }, (payload) => {
            const record = (payload?.payload as { record?: { sender_id?: string } } | undefined)?.record;
            // On ignore ses propres messages (déjà gérés par l'optimistic +
            // réconciliation du flux d'envoi — mig. 047 / Phase 1).
            if (record?.sender_id === currentUserId) return;
            schedule(convId);
          })
          .subscribe();
        channels.push(ch);
      }

      // 2. Canal privé de l'utilisateur → découverte des nouvelles conversations.
      const userCh = supabase
        .channel(`dm-user:${currentUserId}`, { config: { private: true } })
        .on("broadcast", { event: "new_conversation" }, (payload) => {
          const convId = (payload?.payload as { conversation_id?: string } | undefined)?.conversation_id;
          if (convId) onNewConvRef.current(convId);
        })
        .subscribe();
      channels.push(userCh);
    })();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      pending.clear();
      authSub?.unsubscribe();
      for (const ch of channels) supabase.removeChannel(ch);
      channels = [];
    };
  }, [currentUserId, idsKey]);
}

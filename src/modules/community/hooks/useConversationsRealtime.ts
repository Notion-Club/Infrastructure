"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

// Abonnement Supabase Realtime sur la table messages (mig. 039), pour injecter
// les nouveaux messages en live dans le thread + la liste des conversations.
//
// Cycle de vie calqué sur useNotifications (centre de notifications) :
//   1. Abonnement postgres_changes (INSERT) sur public.messages. La RLS
//      messages_select_in_conv (mig. 014) fait le filtrage de sécurité : on
//      ne reçoit en Realtime QUE les messages des conversations dont on est
//      participant. Pas de filtre postgres explicite (on ne peut pas filtrer
//      par participant via postgres_changes — la RLS s'en charge).
//   2. À chaque INSERT, on extrait conversation_id + sender_id du payload.
//      - On ignore ses PROPRES messages (sender_id === me) : ils sont déjà
//        gérés par le flux d'envoi optimistic de MessagesLayout (re-fetch
//        après sendMessageAction). Les inclure ferait un double re-fetch.
//      - Sinon on planifie un refresh de cette conversation via le callback.
//   3. Coalescing : un burst de messages sur la même conv → un seul appel
//      du callback (debounce 300 ms, dédupliqué par conversation_id). Évite
//      N round-trips si plusieurs messages arrivent coup sur coup.
//
// Le callback est lu via un ref (callbackRef) pour ne PAS relancer
// l'abonnement quand MessagesLayout re-render et passe une nouvelle référence
// de fonction. L'abonnement ne dépend que de currentUserId.

// Compteur global → topic de channel unique par montage (même raison que
// useNotifications : en React Strict Mode, monter→démonter→remonter sur le
// même topic déclenche "cannot add postgres_changes callbacks after
// subscribe()"). Un nonce par montage garantit un channel neuf.
let channelSeq = 0;

export function useConversationsRealtime(
  currentUserId: string,
  onIncomingMessage: (conversationId: string) => void,
): void {
  const callbackRef = useRef(onIncomingMessage);
  useEffect(() => {
    callbackRef.current = onIncomingMessage;
  }, [onIncomingMessage]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createSupabaseBrowserClient();
    const nonce = ++channelSeq;

    // Conversations en attente de refresh + timer de coalescing — locaux à
    // l'effet (pas de refs : ils ne survivent pas à un changement de user, ce
    // qui est exactement le comportement voulu).
    const pending = new Set<string>();
    let timer: number | null = null;

    const flush = () => {
      timer = null;
      const ids = Array.from(pending);
      pending.clear();
      for (const id of ids) callbackRef.current(id);
    };

    const schedule = (conversationId: string) => {
      pending.add(conversationId);
      if (timer) return; // un flush est déjà programmé
      timer = window.setTimeout(flush, 300);
    };

    // .on() PUIS .subscribe() dans le même bloc synchrone (contrainte
    // Supabase Realtime — jamais de .on() après subscribe()).
    const channel: RealtimeChannel = supabase
      .channel(`nc-messages:${currentUserId}:${nonce}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as {
            conversation_id?: string;
            sender_id?: string;
          };
          if (!row?.conversation_id) return;
          // Mes propres messages : déjà gérés par l'optimistic + re-fetch du
          // flux d'envoi. On les ignore pour éviter le double round-trip.
          if (row.sender_id === currentUserId) return;
          schedule(row.conversation_id);
        },
      )
      .subscribe();

    return () => {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      pending.clear();
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);
}

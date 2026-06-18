"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

// Abonnement Supabase Realtime sur la table messages (mig. 039), pour injecter
// les nouveaux messages en live dans le thread + la liste des conversations.
//
// Calqué sur useNotifications (centre de notifications) :
//   1. Abonnement postgres_changes (INSERT) sur public.messages. La RLS
//      messages_select_in_conv (mig. 014) fait le filtrage de sécurité : on
//      ne reçoit en Realtime QUE les messages de nos conversations. Pas de
//      filtre postgres explicite (on ne peut pas filtrer par participant via
//      postgres_changes — la RLS s'en charge).
//   2. À chaque INSERT : on ignore ses PROPRES messages (sender_id === me,
//      déjà gérés par l'optimistic + re-fetch du flux d'envoi), sinon on
//      planifie un refresh de la conversation via le callback.
//   3. Coalescing 300 ms (dédupliqué par conversation_id) : un burst de
//      messages → un seul appel du callback par conversation.
//
// Le callback est lu via callbackRef pour ne PAS relancer l'abonnement quand
// MessagesLayout re-render et passe une nouvelle référence de fonction.
// L'abonnement ne dépend que de currentUserId.

// Compteur global → topic de channel unique par montage (même raison que
// useNotifications : monter→démonter→remonter sur le même topic en Strict Mode
// déclenche "cannot add postgres_changes callbacks after subscribe()").
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

    // Coalescing local à l'effet (réinitialisé si le user change).
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
      if (timer) return;
      timer = window.setTimeout(flush, 300);
    };

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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";

// Indicateur "en train d'écrire" via Supabase Realtime broadcast.
// On choisit broadcast (et non presence) car :
//  - le state n'a pas besoin d'être persistant (un user qui quitte la page
//    cesse d'écrire ; pas besoin de "qui est connecté")
//  - on n'a que 2 participants par conv → un simple ping suffit
// Channel par conv : "nc-typing:{conversationId}". Authz native Supabase
// Realtime (channel anonyme, payload non sensible).
//
// Protocole :
//  - L'émetteur envoie `{ type: 'typing', userId, ts }` toutes les ~TYPING_PING_THROTTLE
//    ms tant qu'il tape.
//  - Le récepteur enregistre le `ts` reçu. Si aucun nouveau ping arrive
//    dans TYPING_TIMEOUT_MS, on considère que l'autre a arrêté → on cache
//    l'indicateur.
//  - Pas de "stop" explicite : c'est l'absence de ping pendant TIMEOUT qui
//    fait disparaître l'indicateur. Plus robuste qu'un STOP qui pourrait
//    se perdre (perte de focus, fermeture d'onglet).

const TYPING_PING_THROTTLE_MS = 2000;
const TYPING_TIMEOUT_MS = 4000;

export interface UseTypingPresenceResult {
  // true si l'autre participant a envoyé un ping il y a < TYPING_TIMEOUT_MS.
  otherIsTyping: boolean;
  // À appeler depuis le composer à chaque frappe. Throttle interne pour
  // n'émettre qu'un ping toutes les TYPING_PING_THROTTLE_MS.
  emitTyping: () => void;
}

export function useTypingPresence(
  conversationId: string | null,
  currentUserId: string,
): UseTypingPresenceResult {
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Dernier envoi sortant — pour throttle l'émission.
  const lastSentRef = useRef<number>(0);
  // Timer "l'autre a peut-être arrêté" — armé à chaque ping reçu.
  const otherStopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const supabase = createSupabaseBrowserClient();
    const channelName = `nc-typing:${conversationId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    channel.on("broadcast", { event: "typing" }, (payload) => {
      const data = payload?.payload as { userId?: string } | undefined;
      if (!data?.userId || data.userId === currentUserId) return;
      // Reçu d'un autre participant : on affiche l'indicateur et on arme
      // le timer d'expiration (réarmé à chaque ping reçu).
      setOtherIsTyping(true);
      if (otherStopTimerRef.current) {
        window.clearTimeout(otherStopTimerRef.current);
      }
      otherStopTimerRef.current = window.setTimeout(() => {
        setOtherIsTyping(false);
      }, TYPING_TIMEOUT_MS);
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (otherStopTimerRef.current) {
        window.clearTimeout(otherStopTimerRef.current);
        otherStopTimerRef.current = null;
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
      setOtherIsTyping(false);
    };
  }, [conversationId, currentUserId]);

  const emitTyping = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    const now = Date.now();
    if (now - lastSentRef.current < TYPING_PING_THROTTLE_MS) return;
    lastSentRef.current = now;
    ch.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId, ts: now },
    });
  }, [currentUserId]);

  return { otherIsTyping, emitTyping };
}

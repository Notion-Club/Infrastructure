"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markNotificationAsUnread,
} from "../server/notifications";
import type { Notification } from "../types/notification.types";

// Centre de notifications in-app, branché sur la table notifications (mig. 038).
//
// Cycle de vie :
//   1. Fetch initial via la server action getNotifications() (RLS-scopée au
//      user courant, 50 dernières, antichronologique).
//   2. Abonnement Supabase Realtime sur postgres_changes filtré
//      `recipient_id=eq.{me}` → à chaque INSERT/UPDATE, on re-fetch le feed.
//      On re-fetch plutôt que de patcher le state avec le payload brut car
//      celui-ci ne porte pas l'acteur joint (profiles) — un re-fetch léger
//      garantit des lignes enrichies cohérentes.
//   3. markAsRead / markAllRead : optimistic (patch immédiat du state) puis
//      persistance serveur. Le badge se met à jour instantanément.
//
// On récupère l'id du user via supabase.auth.getUser() côté client (même
// pattern que useProfileIdentity) pour construire le filtre Realtime.

// Compteur global pour générer un topic de channel unique par montage
// (évite la collision Strict Mode décrite dans l'effet).
let channelSeq = 0;

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  markAsUnread: (id: string) => void;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Throttle des re-fetch déclenchés par Realtime : si une annonce admin
  // insère 200 lignes d'un coup, on ne veut pas 200 round-trips. On coalesce
  // les events rapprochés en un seul refresh.
  const refetchTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const fresh = await getNotifications();
    setNotifications(fresh);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refetchTimerRef.current) return; // un refresh est déjà programmé
    refetchTimerRef.current = window.setTimeout(() => {
      refetchTimerRef.current = null;
      void refresh();
    }, 400);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    // Topic unique par montage : en React Strict Mode (dev), l'effet monte →
    // démonte → remonte. Réutiliser le même topic ferait que le 2e .on()
    // s'enregistre sur un channel que Supabase considère déjà subscribe() →
    // "cannot add postgres_changes callbacks after subscribe()". Un nonce
    // par montage garantit un channel neuf à chaque fois.
    const nonce = ++channelSeq;

    async function init() {
      // Fetch initial.
      const fresh = await getNotifications();
      if (cancelled) return;
      setNotifications(fresh);
      setLoading(false);

      // Abonnement Realtime, filtré sur le user courant.
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId || cancelled) return;

      // .on() PUIS .subscribe() dans le même bloc synchrone (jamais de .on()
      // après subscribe — cf. contrainte Supabase Realtime).
      const channel = supabase
        .channel(`nc-notifications:${userId}:${nonce}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `recipient_id=eq.${userId}`,
          },
          () => {
            scheduleRefresh();
          },
        )
        .subscribe();

      // Si l'effet a déjà été nettoyé pendant l'await, on retire aussitôt.
      if (cancelled) {
        supabase.removeChannel(channel);
        return;
      }
      channelRef.current = channel;
    }

    void init();

    return () => {
      cancelled = true;
      if (refetchTimerRef.current) {
        window.clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [scheduleRefresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback((id: string) => {
    // Optimistic : on marque lu localement tout de suite.
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    void markNotificationAsRead(id);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    void markAllNotificationsAsRead();
  }, []);

  // Repasse une notif en non lue (optimistic). Elle quitte "Lues" et
  // réapparaît dans "Non-lues" (le badge se réincrémente).
  const markAsUnread = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: false } : n)),
    );
    void markNotificationAsUnread(id);
  }, []);

  return { notifications, unreadCount, loading, markAsRead, markAllRead, markAsUnread };
}

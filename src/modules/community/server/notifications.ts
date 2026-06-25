"use server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import type { Notification, NotificationType } from "../types/notification.types";

// ============================================================================
// Centre de notifications in-app — lecture + mark-as-read
// ============================================================================
// Alimenté par les triggers DB de la migration 038. Côté client, le hook
// useNotifications fait le fetch initial via getNotifications() puis écoute
// Supabase Realtime pour les nouvelles lignes. markAsRead / markAllRead
// stamp read_at (RLS notifications_update_self garantit qu'un user ne touche
// que ses propres lignes).

const MAX_NOTIFICATIONS = 50;

// Shape DB (snake_case) — interne au module.
type ActorRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
};

type NotificationRow = {
  id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  conversation_id: string | null;
  excerpt: string | null;
  // Renseignés uniquement pour les push admin (type admin_push, mig. 044).
  title: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  actor: ActorRow | null;
};

// Helpers de mapping — alignés sur queries.ts (computeDisplayName /
// computeInitials), dupliqués ici car non exportés là-bas et pour garder
// notifications.ts autonome.
function computeInitials(p: ActorRow): string {
  const fn = p.first_name?.trim();
  const ln = p.last_name?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (ln) return ln.slice(0, 2).toUpperCase();
  const display = p.display_name?.trim();
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return p.username?.slice(0, 2).toUpperCase() ?? "?";
}

function computeDisplayName(p: ActorRow): string {
  const fn = p.first_name?.trim();
  const ln = p.last_name?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (fn) return fn;
  if (ln) return ln;
  return p.display_name?.trim() || p.username || "Utilisateur";
}

function mapRow(row: NotificationRow): Notification {
  const actor = row.actor;
  return {
    id: row.id,
    type: row.type,
    actorId: actor?.id ?? "",
    actorName: actor ? computeDisplayName(actor) : "Utilisateur supprimé",
    actorAvatar: actor?.avatar_url ?? null,
    actorAvatarColor: actor?.avatar_color ?? null,
    actorInitials: actor ? computeInitials(actor) : "?",
    excerpt: row.excerpt ?? "",
    postId: row.post_id ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    title: row.title ?? undefined,
    link: row.link ?? undefined,
    read: row.read_at !== null,
    createdAt: row.created_at,
  };
}

// ----------------------------------------------------------------------------
// getNotifications — feed du user courant (50 dernières, antichronologique)
// ----------------------------------------------------------------------------
// La RLS notifications_select_self filtre déjà sur recipient_id = auth.uid(),
// donc pas besoin de .eq("recipient_id", ...) ici — mais on le garde implicite
// via RLS pour rester safe même si la policy évolue.
export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select(
      `
        id, type, post_id, comment_id, conversation_id,
        excerpt, title, link, read_at, created_at,
        actor:profiles!notifications_actor_id_fkey (
          id, first_name, last_name, display_name, username,
          avatar_url, avatar_color
        )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(MAX_NOTIFICATIONS)
    .returns<NotificationRow[]>();

  if (error) {
    console.error("[getNotifications] failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

// ----------------------------------------------------------------------------
// markAsRead — stamp read_at sur une notif précise (mark-as-read au clic)
// ----------------------------------------------------------------------------
export async function markNotificationAsRead(
  id: string,
): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null); // no-op si déjà lue (évite un write inutile)

  if (error) {
    console.error("[markNotificationAsRead] failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

// ----------------------------------------------------------------------------
// markAllAsRead — bouton "Tout marquer comme lu"
// ----------------------------------------------------------------------------
// RLS borne déjà l'UPDATE aux lignes du user courant. On ne touche que les
// non-lues pour limiter le write.
export async function markAllNotificationsAsRead(): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    console.error("[markAllNotificationsAsRead] failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

// ----------------------------------------------------------------------------
// markNotificationAsUnread — repasse une notif lue en non lue (bouton cloche)
// ----------------------------------------------------------------------------
// Remet read_at à NULL : la notif quitte "Lues" et réapparaît dans "Non-lues"
// (et re-compte dans le badge). RLS update_self borne au user courant. no-op
// si déjà non lue.
export async function markNotificationAsUnread(
  id: string,
): Promise<{ ok: boolean }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: null })
    .eq("id", id)
    .not("read_at", "is", null); // no-op si déjà non lue

  if (error) {
    console.error("[markNotificationAsUnread] failed:", error.message);
    return { ok: false };
  }
  return { ok: true };
}

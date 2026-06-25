import "server-only";

import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

// ============================================================================
// Push admin → entrée dans le centre de notifications in-app
// ============================================================================
// Pendant SERVEUR du Web Push pour les push admin/système. Là où les
// événements community alimentent la table `notifications` via des triggers DB
// (mig. 038), un push envoyé manuellement (sendAdminPushAction) ou via
// /api/push/send part en direct par sendWebPushToUser et ne laisse aucune
// trace in-app. Ce helper comble le trou : il insère une ligne `notifications`
// de type 'admin_push' par destinataire, pour que le push apparaisse aussi
// dans la cloche (Realtime mig. 038 → badge live).
//
// L'insertion se fait via le service_role (bypass RLS) : la table n'a pas de
// policy INSERT côté client, seul le serveur écrit. actor_id = NULL → l'UI
// affiche l'identité Notion Club (pas un profil émetteur).
//
// Colonnes title / link / type admin_push posées par la mig. 044.
//
// Sémantique fire-and-forget : ne throw JAMAIS. Un échec d'écriture in-app ne
// doit pas faire planter l'envoi du push (le push reste la garantie minimale).
// On log et on avale.

export interface AdminPushInApp {
  /** Titre libre du push — affiché tel quel dans la cloche. */
  title: string;
  /** Corps du push — stocké dans excerpt (clippé 140 chars à l'insert). */
  body?: string | null;
  /** Deep-link ouvert au tap (chemin relatif ou URL absolue). */
  link?: string | null;
}

// Construit la ligne d'insert pour un destinataire (forme DB snake_case).
function buildRow(recipientId: string, payload: AdminPushInApp) {
  return {
    recipient_id: recipientId,
    actor_id: null, // push système — pas d'acteur (cf. mig. 044)
    type: "admin_push" as const,
    title: payload.title,
    // L'excerpt est clippé 140 chars côté SQL pour les triggers ; on aligne
    // ici le même plafond pour rester cohérent à la lecture.
    excerpt: payload.body ? payload.body.slice(0, 140) : null,
    link: payload.link ?? null,
  };
}

// Insère une notification in-app 'admin_push' pour chaque destinataire.
// Dédoublonne les recipientIds (un même user ne doit pas avoir 2 lignes pour
// un seul envoi). Ne throw jamais.
export async function createAdminPushNotifications(
  recipientIds: string[],
  payload: AdminPushInApp,
): Promise<void> {
  try {
    const unique = Array.from(new Set(recipientIds.filter(Boolean)));
    if (unique.length === 0) return;

    const admin = createSupabaseAdminClient();
    const rows = unique.map((id) => buildRow(id, payload));

    const { error } = await admin.from("notifications").insert(rows);
    if (error) {
      console.error(
        "[createAdminPushNotifications] insert in-app échoué (non bloquant):",
        error.message,
      );
    }
  } catch (err) {
    console.error(
      "[createAdminPushNotifications] échec inattendu (non bloquant):",
      err,
    );
  }
}

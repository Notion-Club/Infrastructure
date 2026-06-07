// Source de vérité unique pour les capabilities Supabase.
// Doit rester strictement alignée sur :
//   - la whitelist de la fonction SQL user_has_capability() (migration 013)
//   - les colonnes booléennes de la table offers (migrations 003 + 013)
//   - le jsonb retourné par get_user_capabilities() (migration 032)
//
// Toute addition de capability nécessite :
//   1. Ajout colonne booléenne sur offers (migration)
//   2. Ajout à la whitelist de user_has_capability (migration)
//   3. Ajout au jsonb de get_user_capabilities (migration)
//   4. Ajout au type Capability ci-dessous
//   5. Ajout au record UserCapabilities ci-dessous

export type Capability =
  | "can_access_challenge_program"
  | "can_access_paid_programs"
  | "can_message_admins"
  | "can_view_community"
  | "can_view_paid_content"
  | "can_book_calls"
  | "can_view_call_summaries"
  | "can_access_templates_library";

export type UserCapabilities = Record<Capability, boolean>;

// Valeur par défaut (tout false) pour les users sans membership active ou
// les cas d'erreur silencieuse côté serveur.
export const DEFAULT_USER_CAPABILITIES: UserCapabilities = {
  can_access_challenge_program: false,
  can_access_paid_programs: false,
  can_message_admins: false,
  can_view_community: false,
  can_view_paid_content: false,
  can_book_calls: false,
  can_view_call_summaries: false,
  can_access_templates_library: false,
};

// ─── Mapping ressources Notion → capability requise ────────────────
// Aligné sur migration 031 (table resources_access seed).
// Null = pas de gating (accessible à tout user authentifié).
export type ResourceVisibility =
  | "Publique"
  | "Challenge Gratuit"
  | "Formation"
  | "Accompagnement";

export const VISIBILITY_TO_CAPABILITY: Record<
  ResourceVisibility,
  Capability | null
> = {
  Publique: null,
  "Challenge Gratuit": "can_access_challenge_program",
  Formation: "can_access_paid_programs",
  Accompagnement: "can_access_paid_programs",
};

// Vérifie l'accès d'un user à une visibilité ressource, sur la base de ses
// capabilities côté client. Pour le gating réel (server-side), passer par
// resolveResourceAccess() — celui-ci est le miroir client/logique partagée.
export function hasAccessToVisibility(
  visibility: ResourceVisibility,
  caps: UserCapabilities,
): boolean {
  const required = VISIBILITY_TO_CAPABILITY[visibility];
  if (required === null) return true;
  return caps[required] === true;
}

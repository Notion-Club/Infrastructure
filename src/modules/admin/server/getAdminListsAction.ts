"use server";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

// Server Actions consommées par le dev tool admin (cf. AdminPushDevCard) pour
// nourrir les deux pickers : sélection multi-membres et picker d'URL
// hiérarchique. Le contrôle d'admin est fait à la lecture : un membre standard
// reçoit un payload vide / "not admin" et ne peut rien faire de plus.
//
// Pas de bypass RLS — on lit via le client cookies-aware, la policy
// profiles_select_same_org (mig. 025) garantit que l'admin voit bien tous
// les profils de son organisation.

// ============================================================================
// listAdminMembersAction — pour le picker multi-membres
// ============================================================================

export type AdminMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  avatarColor: string | null;
  initials: string;
  role: "admin" | "mentor" | "member";
};

async function ensureAdmin(): Promise<{ ok: true } | { ok: false }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  return profile?.role === "admin" ? { ok: true } : { ok: false };
}

function computeInitialsFrom(
  firstName: string | null,
  lastName: string | null,
  displayName: string | null,
  username: string | null,
): string {
  const fn = firstName?.trim();
  const ln = lastName?.trim();
  if (fn && ln) return `${fn[0]}${ln[0]}`.toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (ln) return ln.slice(0, 2).toUpperCase();
  const display = displayName?.trim();
  if (display) {
    const parts = display.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
    }
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  if (username) return username.slice(0, 2).toUpperCase();
  return "?";
}

function computeNameFrom(
  firstName: string | null,
  lastName: string | null,
  displayName: string | null,
  username: string | null,
): string {
  const fn = firstName?.trim();
  const ln = lastName?.trim();
  if (fn && ln) return `${fn} ${ln}`;
  if (displayName?.trim()) return displayName.trim();
  if (fn) return fn;
  if (ln) return ln;
  if (username) return `@${username}`;
  return "Invité";
}

export async function listAdminMembersAction(): Promise<AdminMember[]> {
  const gate = await ensureAdmin();
  if (!gate.ok) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, display_name, username, avatar_url, avatar_color, role",
    )
    .order("first_name", { ascending: true, nullsFirst: false })
    .limit(200)
    .returns<
      Array<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
        avatar_color: string | null;
        role: string | null;
      }>
    >();

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    name: computeNameFrom(p.first_name, p.last_name, p.display_name, p.username),
    avatarUrl: p.avatar_url,
    avatarColor: p.avatar_color,
    initials: computeInitialsFrom(
      p.first_name,
      p.last_name,
      p.display_name,
      p.username,
    ),
    role:
      p.role === "admin" || p.role === "mentor"
        ? (p.role as "admin" | "mentor")
        : "member",
  }));
}

// ============================================================================
// getAdminUrlTreeAction — arbre des URLs pour le picker fil d'Ariane
// ============================================================================

export type UrlTreeNode = {
  id: string;
  label: string;
  url: string | null; // null = dossier (non sélectionnable directement)
  children?: UrlTreeNode[];
};

// Routes statiques côté plateforme — alignées avec la nav principale
// (Topbar). On expose les pages racines + qq sous-pages qui ont du sens
// comme cible de notif (DM, post, settings…). À enrichir au fil de l'eau.
const STATIC_TREE: UrlTreeNode[] = [
  { id: "dashboard", label: "Dashboard", url: "/dashboard" },
  {
    id: "communaute",
    label: "Communauté",
    url: "/communaute",
    children: [
      { id: "communaute-messages", label: "Messages", url: "/communaute/messages" },
    ],
  },
  { id: "coaching", label: "Coaching", url: "/coaching" },
  { id: "ressources", label: "Ressources", url: "/ressources" },
  {
    id: "settings",
    label: "Réglages",
    url: "/settings",
    children: [
      { id: "settings-notifications", label: "Notifications", url: "/settings#notifications" },
      { id: "settings-profile", label: "Profil", url: "/settings#profile" },
      { id: "settings-security", label: "Sécurité", url: "/settings#security" },
    ],
  },
];

export async function getAdminUrlTreeAction(): Promise<UrlTreeNode[]> {
  const gate = await ensureAdmin();
  if (!gate.ok) return STATIC_TREE;

  const supabase = await createSupabaseServerClient();

  // Branche Formation : on construit le sous-arbre dynamiquement depuis
  // les tables Supabase (synchronisées depuis Notion). Une formation =
  // un dossier de premier niveau ; chaque module = sous-dossier ;
  // chaque cours = feuille sélectionnable.
  const [{ data: formations }, { data: modules }, { data: courses }] =
    await Promise.all([
      supabase
        .from("formations")
        .select("id, slug, name, position")
        .order("position", { ascending: true })
        .returns<Array<{ id: string; slug: string; name: string; position: number }>>(),
      supabase
        .from("formation_modules")
        .select("id, slug, name, position, formation_id")
        .order("position", { ascending: true })
        .returns<
          Array<{
            id: string;
            slug: string;
            name: string;
            position: number;
            formation_id: string;
          }>
        >(),
      supabase
        .from("formation_courses")
        .select("id, slug, name, position, module_id")
        .order("position", { ascending: true })
        .returns<
          Array<{
            id: string;
            slug: string;
            name: string;
            position: number;
            module_id: string;
          }>
        >(),
    ]);

  const formationNode: UrlTreeNode = {
    id: "formation",
    label: "Formation",
    url: "/formation",
    children: (formations ?? []).map((f) => ({
      id: `formation-${f.id}`,
      label: f.name,
      url: `/formation/${f.slug}`,
      children: (modules ?? [])
        .filter((m) => m.formation_id === f.id)
        .map((m) => ({
          id: `module-${m.id}`,
          label: m.name,
          url: `/formation/${f.slug}/${m.slug}`,
          children: (courses ?? [])
            .filter((c) => c.module_id === m.id)
            .map((c) => ({
              id: `course-${c.id}`,
              label: c.name,
              url: `/formation/${f.slug}/${m.slug}/${c.slug}`,
            })),
        })),
    })),
  };

  // On insère Formation en deuxième position (après Dashboard) pour suivre
  // l'ordre de la nav Topbar.
  return [STATIC_TREE[0]!, formationNode, ...STATIC_TREE.slice(1)];
}

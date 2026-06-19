"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { createSupabaseAdminClient } from "@/shared/lib/supabase/admin";

// ============================================================================
// Page admin « Membres » — couche de données.
//
// Source de vérité : tables Supabase réelles (profiles, memberships, offers,
// formations / formation_courses / formation_course_progress, coaching_calls)
// + emails depuis auth.users. Le design Claude Design (« Membres Admin »)
// tournait sur des données mockées ; ici on branche les vraies tables.
//
// Sécurité — double défense, identique au pattern AdminPushDevCard :
//   1. UI  : la carte n'apparaît dans le DevToolbox QUE pour les admins, et la
//            route /membres redirige les non-admins vers /dashboard.
//   2. API : chaque Server Action re-vérifie role='admin' avant tout accès.
//            La lecture/écriture passe par le client service_role (bypass RLS)
//            UNIQUEMENT après ce contrôle, et reste scoppée à l'organisation
//            de l'admin appelant.
// ============================================================================

export type AdminMemberRole = "member" | "mentor" | "admin";
export type MembershipStatus =
  | "active"
  | "expired"
  | "cancelled"
  | "refunded"
  | "paused";

export type AdminMemberMembership = {
  id: string;
  offerSlug: string;
  offerName: string;
  status: MembershipStatus;
  source: string | null;
  priceEur: number;
  startsAt: string | null;
  expiresAt: string | null;
};

export type AdminMemberFormation = {
  name: string;
  totalCourses: number;
  completed: number;
  started: number;
  pct: number;
};

export type AdminMemberDetail = {
  id: string;
  name: string;
  initials: string;
  username: string | null;
  email: string | null;
  communicationEmail: string | null;
  phone: string | null;
  city: string | null;
  company: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  role: AdminMemberRole;
  isBanned: boolean;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  // Offre courante (membership active la plus récente, sinon la plus récente).
  currentOfferSlug: string | null;
  currentOfferName: string | null;
  membershipStatus: MembershipStatus | null;
  expiresAt: string | null;
  totalPaidEur: number;
  memberships: AdminMemberMembership[];
  formations: AdminMemberFormation[];
  avgCompletion: number;
  callsCount: number;
  noShowsCount: number;
  nextCallAt: string | null;
};

export type AdminOfferOption = {
  slug: string;
  name: string;
  priceEur: number;
  isPaid: boolean;
};

export type MembersAdminData = {
  members: AdminMemberDetail[];
  offers: AdminOfferOption[];
};

// ── Gate ────────────────────────────────────────────────────────────────────

type AdminGate =
  | { ok: true; userId: string; organizationId: string | null }
  | { ok: false };

async function ensureAdmin(): Promise<AdminGate> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null; organization_id: string | null }>();

  if (profile?.role !== "admin") return { ok: false };
  return { ok: true, userId: user.id, organizationId: profile.organization_id };
}

// ── Helpers de formatage ──────────────────────────────────────────────────────

function normalizeRole(role: string | null): AdminMemberRole {
  return role === "admin" || role === "mentor" ? role : "member";
}

function computeName(
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
  if (username?.trim()) return `@${username.trim()}`;
  return "Invité";
}

function computeInitials(
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
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  }
  if (username?.trim()) return username.trim().slice(0, 2).toUpperCase();
  return "?";
}

// Une membership compte pour de l'« encaissé » si elle a un prix réel
// (price_paid_eur) — sinon on retombe sur le prix par défaut de l'offre.
function membershipRevenue(
  pricePaid: number | null,
  offerDefault: number | null,
): number {
  if (typeof pricePaid === "number" && pricePaid > 0) return pricePaid;
  if (typeof offerDefault === "number" && offerDefault > 0) return offerDefault;
  return 0;
}

// ============================================================================
// getMembersAdminData — lecture principale (liste + agrégats)
// ============================================================================

export async function getMembersAdminData(): Promise<MembersAdminData> {
  const gate = await ensureAdmin();
  if (!gate.ok) return { members: [], offers: [] };

  const admin = createSupabaseAdminClient();

  // Profils de l'organisation de l'admin (non supprimés).
  let profilesQuery = admin
    .from("profiles")
    .select(
      "id, first_name, last_name, display_name, username, avatar_url, avatar_color, role, is_banned, email_verified_at, communication_email, phone, billing_city, billing_name, billing_company_id, created_at, last_login_at, last_active_at, organization_id",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (gate.organizationId) {
    profilesQuery = profilesQuery.eq("organization_id", gate.organizationId);
  }

  const [
    profilesRes,
    membershipsRes,
    offersRes,
    formationsRes,
    coursesRes,
    progressRes,
    callsRes,
    companiesRes,
    authUsers,
  ] = await Promise.all([
    profilesQuery.returns<ProfileRow[]>(),
    admin
      .from("memberships")
      .select(
        "id, profile_id, status, source, price_paid_eur, starts_at, expires_at, created_at, offers(slug, name, default_price_eur, is_paid)",
      )
      .returns<MembershipRow[]>(),
    admin
      .from("offers")
      .select("slug, name, default_price_eur, is_paid, is_active")
      .eq("is_active", true)
      .returns<OfferRow[]>(),
    admin
      .from("formations")
      .select("id, name, position")
      .order("position", { ascending: true })
      .returns<FormationRow[]>(),
    admin
      .from("formation_courses")
      .select("id, formation_id")
      .returns<CourseRow[]>(),
    admin
      .from("formation_course_progress")
      .select("profile_id, course_id, status")
      .returns<ProgressRow[]>(),
    admin
      .from("coaching_calls")
      .select("profile_id, scheduled_at, status")
      .returns<CallRow[]>(),
    admin.from("companies").select("id, name").returns<CompanyRow[]>(),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailById = new Map<string, string>();
  for (const u of authUsers.data?.users ?? []) {
    if (u.id && u.email) emailById.set(u.id, u.email);
  }

  const companyById = new Map<string, string>();
  for (const c of companiesRes.data ?? []) companyById.set(c.id, c.name);

  // course_id -> formation_id, et nombre de cours par formation.
  const courseFormation = new Map<string, string>();
  const coursesPerFormation = new Map<string, number>();
  for (const c of coursesRes.data ?? []) {
    if (!c.formation_id) continue;
    courseFormation.set(c.id, c.formation_id);
    coursesPerFormation.set(
      c.formation_id,
      (coursesPerFormation.get(c.formation_id) ?? 0) + 1,
    );
  }
  const formationList = formationsRes.data ?? [];

  // memberships groupées par profil.
  const membershipsByProfile = new Map<string, MembershipRow[]>();
  for (const m of membershipsRes.data ?? []) {
    const arr = membershipsByProfile.get(m.profile_id) ?? [];
    arr.push(m);
    membershipsByProfile.set(m.profile_id, arr);
  }

  // progress groupé par profil -> par formation.
  const progressByProfile = new Map<
    string,
    Map<string, { started: number; completed: number }>
  >();
  for (const p of progressRes.data ?? []) {
    const formationId = courseFormation.get(p.course_id);
    if (!formationId) continue;
    let byFormation = progressByProfile.get(p.profile_id);
    if (!byFormation) {
      byFormation = new Map();
      progressByProfile.set(p.profile_id, byFormation);
    }
    const cell = byFormation.get(formationId) ?? { started: 0, completed: 0 };
    cell.started += 1;
    if (p.status === "completed") cell.completed += 1;
    byFormation.set(formationId, cell);
  }

  // coaching groupé par profil.
  const callsByProfile = new Map<string, CallRow[]>();
  for (const c of callsRes.data ?? []) {
    const arr = callsByProfile.get(c.profile_id) ?? [];
    arr.push(c);
    callsByProfile.set(c.profile_id, arr);
  }

  const members: AdminMemberDetail[] = (profilesRes.data ?? []).map((p) => {
    const rawMems = membershipsByProfile.get(p.id) ?? [];
    const memberships: AdminMemberMembership[] = rawMems
      .map((m) => ({
        id: m.id,
        offerSlug: m.offers?.slug ?? "—",
        offerName: m.offers?.name ?? "Offre",
        status: (m.status ?? "active") as MembershipStatus,
        source: m.source,
        priceEur: membershipRevenue(
          m.price_paid_eur,
          m.offers?.default_price_eur ?? null,
        ),
        startsAt: m.starts_at,
        expiresAt: m.expires_at,
      }))
      .sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""));

    // Offre courante : membership active la plus récente, sinon la plus récente.
    const activeMem =
      memberships.find((m) => m.status === "active") ?? memberships[0] ?? null;

    const totalPaidEur = memberships.reduce((sum, m) => sum + m.priceEur, 0);

    // Formations : une ligne par formation existante (réelle).
    const byFormation = progressByProfile.get(p.id);
    const formations: AdminMemberFormation[] = formationList.map((f) => {
      const total = coursesPerFormation.get(f.id) ?? 0;
      const cell = byFormation?.get(f.id) ?? { started: 0, completed: 0 };
      const pct =
        total > 0 ? Math.round((cell.completed / total) * 100) : 0;
      return {
        name: f.name,
        totalCourses: total,
        completed: cell.completed,
        started: cell.started,
        pct,
      };
    });
    const avgCompletion =
      formations.length > 0
        ? Math.round(
            formations.reduce((a, b) => a + b.pct, 0) / formations.length,
          )
        : 0;

    const calls = callsByProfile.get(p.id) ?? [];
    const noShowsCount = calls.filter((c) => c.status === "no_show").length;
    const now = Date.now();
    const upcoming = calls
      .filter(
        (c) =>
          c.scheduled_at &&
          new Date(c.scheduled_at).getTime() > now &&
          c.status !== "cancelled",
      )
      .sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

    return {
      id: p.id,
      name: computeName(p.first_name, p.last_name, p.display_name, p.username),
      initials: computeInitials(
        p.first_name,
        p.last_name,
        p.display_name,
        p.username,
      ),
      username: p.username,
      email: emailById.get(p.id) ?? null,
      communicationEmail: p.communication_email,
      phone: p.phone,
      city: p.billing_city,
      company: p.billing_company_id
        ? (companyById.get(p.billing_company_id) ?? p.billing_name)
        : p.billing_name,
      avatarUrl: p.avatar_url,
      avatarColor: p.avatar_color,
      role: normalizeRole(p.role),
      isBanned: p.is_banned ?? false,
      emailVerified: p.email_verified_at != null,
      createdAt: p.created_at,
      lastLoginAt: p.last_login_at,
      lastActiveAt: p.last_active_at,
      currentOfferSlug: activeMem?.offerSlug ?? null,
      currentOfferName: activeMem?.offerName ?? null,
      membershipStatus: activeMem?.status ?? null,
      expiresAt: activeMem?.expiresAt ?? null,
      totalPaidEur,
      memberships,
      formations,
      avgCompletion,
      callsCount: calls.length,
      noShowsCount,
      nextCallAt: upcoming[0]?.scheduled_at ?? null,
    };
  });

  const offers: AdminOfferOption[] = (offersRes.data ?? []).map((o) => ({
    slug: o.slug,
    name: o.name,
    priceEur:
      typeof o.default_price_eur === "number" ? o.default_price_eur : 0,
    isPaid: o.is_paid ?? false,
  }));

  return { members, offers };
}

// ============================================================================
// Mutations — toutes admin-gated + revalidatePath('/membres')
// ============================================================================

type MutationResult =
  | { ok: true }
  | { ok: false; code: "forbidden" | "validation" | "error"; message: string };

const roleSchema = z.object({
  profileId: z.string().uuid(),
  role: z.enum(["member", "mentor", "admin"]),
});

export async function setMemberRoleAction(raw: unknown): Promise<MutationResult> {
  const gate = await ensureAdmin();
  if (!gate.ok)
    return { ok: false, code: "forbidden", message: "Réservé aux administrateurs." };

  const parsed = roleSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, code: "validation", message: "Rôle invalide." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.profileId);

  if (error) return { ok: false, code: "error", message: error.message };
  revalidatePath("/membres");
  return { ok: true };
}

const banSchema = z.object({
  profileId: z.string().uuid(),
  banned: z.boolean(),
});

export async function setMemberBannedAction(
  raw: unknown,
): Promise<MutationResult> {
  const gate = await ensureAdmin();
  if (!gate.ok)
    return { ok: false, code: "forbidden", message: "Réservé aux administrateurs." };

  const parsed = banSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, code: "validation", message: "Payload invalide." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_banned: parsed.data.banned })
    .eq("id", parsed.data.profileId);

  if (error) return { ok: false, code: "error", message: error.message };
  revalidatePath("/membres");
  return { ok: true };
}

const grantSchema = z.object({
  profileId: z.string().uuid(),
  offerSlug: z.string().min(1).max(80),
});

export async function grantOfferAction(raw: unknown): Promise<MutationResult> {
  const gate = await ensureAdmin();
  if (!gate.ok)
    return { ok: false, code: "forbidden", message: "Réservé aux administrateurs." };

  const parsed = grantSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, code: "validation", message: "Payload invalide." };

  const admin = createSupabaseAdminClient();

  // Résout l'offre + l'organisation du membre (denormalisée sur memberships).
  const [{ data: offer }, { data: profile }] = await Promise.all([
    admin
      .from("offers")
      .select("id, default_duration_days")
      .eq("slug", parsed.data.offerSlug)
      .maybeSingle<{ id: string; default_duration_days: number | null }>(),
    admin
      .from("profiles")
      .select("organization_id")
      .eq("id", parsed.data.profileId)
      .maybeSingle<{ organization_id: string | null }>(),
  ]);

  if (!offer)
    return { ok: false, code: "validation", message: "Offre introuvable." };

  const days = offer.default_duration_days;
  const expiresAt =
    typeof days === "number" && days > 0
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : null;

  const { error } = await admin.from("memberships").insert({
    profile_id: parsed.data.profileId,
    offer_id: offer.id,
    organization_id: profile?.organization_id ?? null,
    status: "active",
    source: "admin_grant",
    duration_type: expiresAt ? "days_120" : "lifetime",
    starts_at: new Date().toISOString(),
    expires_at: expiresAt,
  });

  if (error) return { ok: false, code: "error", message: error.message };
  revalidatePath("/membres");
  return { ok: true };
}

const revokeSchema = z.object({
  membershipId: z.string().uuid(),
});

export async function revokeMembershipAction(
  raw: unknown,
): Promise<MutationResult> {
  const gate = await ensureAdmin();
  if (!gate.ok)
    return { ok: false, code: "forbidden", message: "Réservé aux administrateurs." };

  const parsed = revokeSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, code: "validation", message: "Payload invalide." };

  const admin = createSupabaseAdminClient();
  // On annule (cancelled) plutôt que de supprimer : on garde la trace.
  const { error } = await admin
    .from("memberships")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.membershipId);

  if (error) return { ok: false, code: "error", message: error.message };
  revalidatePath("/membres");
  return { ok: true };
}

// ── Types lignes brutes (shape PostgREST) ────────────────────────────────────

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  role: string | null;
  is_banned: boolean | null;
  email_verified_at: string | null;
  communication_email: string | null;
  phone: string | null;
  billing_city: string | null;
  billing_name: string | null;
  billing_company_id: string | null;
  created_at: string;
  last_login_at: string | null;
  last_active_at: string | null;
  organization_id: string | null;
};

type MembershipRow = {
  id: string;
  profile_id: string;
  status: string | null;
  source: string | null;
  price_paid_eur: number | null;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  offers: {
    slug: string;
    name: string;
    default_price_eur: number | null;
    is_paid: boolean | null;
  } | null;
};

type OfferRow = {
  slug: string;
  name: string;
  default_price_eur: number | null;
  is_paid: boolean | null;
  is_active: boolean | null;
};

type FormationRow = { id: string; name: string; position: number | null };
type CourseRow = { id: string; formation_id: string | null };
type ProgressRow = {
  profile_id: string;
  course_id: string;
  status: string | null;
};
type CallRow = {
  profile_id: string;
  scheduled_at: string | null;
  status: string | null;
};
type CompanyRow = { id: string; name: string };

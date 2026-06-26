"use client";

import { useMemo, useState, useTransition } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  CreditCard,
  Mail,
  MessageCircle,
  Search,
  SearchX,
  Wallet,
  X,
} from "lucide-react";

import {
  Bell,
  CheckmarkSealText,
  ClockArrowReverseDotted,
  GraduationCap,
  IphoneRadiowaves,
  PersonBadgeMinus,
  PersonCircleFill,
} from "@/shared/components/icons";
import type {
  AdminMemberDetail,
  AdminMemberRole,
  AdminOfferOption,
} from "@/modules/admin/server/getMembersAdminAction";
import {
  grantOfferAction,
  revokeMembershipAction,
  setMemberBannedAction,
  setMemberRoleAction,
} from "@/modules/admin/server/getMembersAdminAction";

// ── Couleurs sémantiques de statut (centralisées — pas de hex dispersé) ───────
// Les tokens de marque/surface viennent de globals.css ; ici on ne garde que
// les 4 teintes sémantiques (succès / alerte / danger / neutre) qui n'ont pas
// d'équivalent token, regroupées en un seul endroit modifiable.
const SEMANTIC = {
  success: "#22c55e",
  successText: "#16a34a",
  warning: "#f59e0b",
  danger: "#ef4444",
  neutral: "#94a3b8",
} as const;
const HALO = {
  success: "rgba(34,197,94,.3)",
  warning: "rgba(245,158,11,.3)",
  danger: "rgba(239,68,68,.3)",
  neutral: "rgba(148,163,184,.3)",
} as const;

// Page admin « Gestion des membres » — portage du design Claude Design
// (« Membres Admin ») branché sur les vraies tables Supabase.
//
// Structure : KPIs → toolbar (recherche / tri / chips de filtre) → grille de
// cartes membre → drawer de détail (rôle, paiements, formations, activité,
// ban). Tout le filtrage/tri est client-side ; les mutations passent par des
// Server Actions admin-gated puis router.refresh() pour relire les données.

const DAY = 86_400_000;

// ── Helpers de formatage ──────────────────────────────────────────────────────

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
}
function rel(d: number | null): string {
  if (d == null) return "jamais";
  if (d <= 0) return "aujourd'hui";
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  if (d < 30) return `il y a ${Math.floor(d / 7)} sem`;
  if (d < 365) return `il y a ${Math.floor(d / 30)} mois`;
  const y = Math.floor(d / 365);
  return `il y a ${y}${y > 1 ? " ans" : " an"}`;
}
function eur(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}
function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
}
function fullDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type StatusKey = "banned" | "expired" | "expiring" | "active";
type Status = { key: StatusKey; label: string; color: string; halo: string };

function statusOf(m: AdminMemberDetail): Status {
  if (m.isBanned)
    return { key: "banned", label: "Banni", color: SEMANTIC.danger, halo: HALO.danger };
  if (m.membershipStatus !== "active")
    return {
      key: "expired",
      label: "Abonnement expiré",
      color: SEMANTIC.neutral,
      halo: HALO.neutral,
    };
  const d = daysUntil(m.expiresAt);
  if (d != null && d <= 21)
    return { key: "expiring", label: "Expire bientôt", color: SEMANTIC.warning, halo: HALO.warning };
  return { key: "active", label: "Actif", color: SEMANTIC.success, halo: HALO.success };
}

function roleLabel(r: AdminMemberRole): string {
  return r === "admin" ? "Admin" : r === "mentor" ? "Mentor" : "Membre";
}
function avatarBg(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  const h2 = (h + 40) % 360;
  return `linear-gradient(150deg,hsl(${h},46%,40%),hsl(${h2},52%,26%))`;
}
function offerColor(slug: string | null, isPaid: boolean): string {
  if (slug === "accompagnement") return "rgba(124,58,237,.85)";
  if (isPaid) return "rgba(224,98,90,.92)";
  return "rgba(20,18,17,.5)";
}
function sourceLabel(src: string | null): string {
  if (!src) return "—";
  const map: Record<string, string> = {
    lp_challenge: "Landing page",
    sync_notion: "Sync Notion",
    oauth_google: "Google",
    admin_grant: "Admin",
    stripe: "Stripe",
  };
  return map[src] ?? src;
}

type SortKey = "recent" | "name" | "revenue" | "login" | "progress";
type StatusFilter =
  | "all"
  | "active"
  | "expiring"
  | "expired"
  | "inactive"
  | "banned";
type RoleFilter = "all" | "mentor";

export default function MembresPageClient({
  members,
  offers,
}: {
  members: AdminMemberDetail[];
  offers: AdminOfferOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grantPick, setGrantPick] = useState<string>(offers[0]?.slug ?? "");

  const offerBySlug = useMemo(() => {
    const map = new Map<string, AdminOfferOption>();
    for (const o of offers) map.set(o.slug, o);
    return map;
  }, [offers]);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const activeCount = members.filter(
      (m) => !m.isBanned && m.membershipStatus === "active",
    ).length;
    const revenue = members.reduce((a, m) => a + m.totalPaidEur, 0);
    const avgCompletion =
      members.length > 0
        ? Math.round(
            members.reduce((a, m) => a + m.avgCompletion, 0) / members.length,
          )
        : 0;
    const inactive = members.filter((m) => {
      if (m.isBanned) return false;
      const d = daysSince(m.lastLoginAt);
      return d == null || d > 30;
    }).length;
    return [
      {
        label: "Membres actifs",
        value: String(activeCount),
        Icon: PersonCircleFill,
        color: "var(--color-text-primary)",
        delta: `/ ${members.length}`,
      },
      {
        label: "Revenu encaissé",
        value: eur(revenue),
        Icon: Wallet,
        color: "var(--color-brand)",
        delta: "cumul",
      },
      {
        label: "Complétion moyenne",
        value: `${avgCompletion} %`,
        Icon: GraduationCap,
        color: "var(--color-text-primary)",
        delta: "formations",
      },
      {
        label: "À relancer (>30j)",
        value: String(inactive),
        Icon: ClockArrowReverseDotted,
        color: inactive > 0 ? SEMANTIC.warning : "var(--color-text-primary)",
        delta: "inactifs",
      },
    ] satisfies Array<{
      label: string;
      value: string;
      Icon: ComponentType<{ size?: number | string }>;
      color: string;
      delta: string;
    }>;
  }, [members]);

  // ── Filtres + tri ─────────────────────────────────────────────────────────
  const cnt = (fn: (m: AdminMemberDetail) => boolean) =>
    members.filter(fn).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = members.filter((m) => {
      if (
        q &&
        !(
          m.name.toLowerCase().includes(q) ||
          (m.username ?? "").toLowerCase().includes(q) ||
          (m.email ?? "").toLowerCase().includes(q)
        )
      )
        return false;
      if (roleFilter === "mentor" && m.role !== "mentor") return false;
      const sf = statusFilter;
      if (sf === "active" && !(!m.isBanned && m.membershipStatus === "active"))
        return false;
      if (sf === "expired" && !(!m.isBanned && m.membershipStatus !== "active"))
        return false;
      if (sf === "expiring") {
        const d = daysUntil(m.expiresAt);
        if (
          !(
            !m.isBanned &&
            m.membershipStatus === "active" &&
            d != null &&
            d <= 21
          )
        )
          return false;
      }
      if (sf === "inactive") {
        const d = daysSince(m.lastLoginAt);
        if (!((d == null || d > 30) && !m.isBanned)) return false;
      }
      if (sf === "banned" && !m.isBanned) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "revenue") return b.totalPaidEur - a.totalPaidEur;
      if (sortKey === "login")
        return (daysSince(a.lastLoginAt) ?? 9e9) - (daysSince(b.lastLoginAt) ?? 9e9);
      if (sortKey === "progress") return b.avgCompletion - a.avgCompletion;
      // recent : created_at décroissant
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
    return list;
  }, [members, search, roleFilter, statusFilter, sortKey]);

  const selected = useMemo(
    () => members.find((m) => m.id === selectedId) ?? null,
    [members, selectedId],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  function runMutation(
    fn: () => Promise<{ ok: boolean; message?: string }>,
    successMsg: string,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.message ?? "Action impossible.");
        return;
      }
      toast.success(successMsg);
      router.refresh();
    });
  }

  function changeRole(role: AdminMemberRole) {
    if (!selected || selected.role === role) return;
    runMutation(
      () => setMemberRoleAction({ profileId: selected.id, role }),
      `Rôle mis à jour : ${roleLabel(role)}.`,
    );
  }
  function toggleBan() {
    if (!selected) return;
    const next = !selected.isBanned;
    runMutation(
      () => setMemberBannedAction({ profileId: selected.id, banned: next }),
      next ? "Membre banni." : "Membre débanni.",
    );
  }
  function grant() {
    if (!selected || !grantPick) return;
    runMutation(
      () => grantOfferAction({ profileId: selected.id, offerSlug: grantPick }),
      `Offre accordée : ${offerBySlug.get(grantPick)?.name ?? grantPick}.`,
    );
  }
  function revoke(membershipId: string) {
    runMutation(
      () => revokeMembershipAction({ membershipId }),
      "Offre révoquée.",
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const cardSurface: React.CSSProperties = {
    background: "var(--color-surface-card)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 16,
  };

  return (
    <>
      <div className="nc-page-halo" style={{ minHeight: "100lvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            className="px-4 pt-[96px] pb-[120px] md:px-10 md:pt-[148px] md:pb-12"
            style={{ maxWidth: 1000, margin: "0 auto" }}
          >
            {/* En-tête */}
            <div
              className="nc-mode-in"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-muted)",
                  }}
                >
                  NotionClub · Admin
                </span>
                <h1
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-.02em",
                    margin: 0,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Gestion des membres
                </h1>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  background: "var(--color-surface-card)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 100,
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: SEMANTIC.success,
                  }}
                />
                {members.length} membre{members.length > 1 ? "s" : ""}
              </div>
            </div>

            {/* KPIs */}
            <section
              className="nc-mode-in"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {kpis.map((k) => (
                <div
                  key={k.label}
                  style={{
                    ...cardSurface,
                    padding: "18px 20px",
                    boxShadow: "var(--nc-shadow-3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-muted)",
                        fontWeight: 500,
                      }}
                    >
                      {k.label}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        display: "inline-flex",
                        color: "var(--color-text-muted)",
                      }}
                    >
                      <k.Icon size={16} />
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 29,
                        fontWeight: 700,
                        letterSpacing: "-.02em",
                        whiteSpace: "nowrap",
                        color: k.color,
                      }}
                    >
                      {k.value}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {k.delta}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            {/* Toolbar */}
            <section
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: 13,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--color-text-muted)",
                      display: "inline-flex",
                      pointerEvents: "none",
                    }}
                  >
                    <Search size={16} />
                  </span>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un membre, un email…"
                    style={{
                      width: "100%",
                      padding: "11px 14px 11px 38px",
                      background: "var(--color-surface-card)",
                      border: "1px solid var(--color-border-default)",
                      borderRadius: 12,
                      fontSize: 14,
                      fontFamily: "inherit",
                      color: "var(--color-text-primary)",
                      outline: "none",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--color-surface-card)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 12,
                    padding: "4px 6px 4px 12px",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-muted)",
                      fontWeight: 500,
                    }}
                  >
                    Trier
                  </span>
                  <select
                    value={sortKey}
                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontFamily: "inherit",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                      outline: "none",
                      cursor: "pointer",
                      padding: "6px 4px",
                    }}
                  >
                    <option value="recent">Plus récents</option>
                    <option value="name">Nom (A→Z)</option>
                    <option value="revenue">Revenu encaissé</option>
                    <option value="login">Dernière connexion</option>
                    <option value="progress">Progression</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Chip
                  active={statusFilter === "all" && roleFilter === "all"}
                  label="Tous"
                  count={members.length}
                  onClick={() => {
                    setStatusFilter("all");
                    setRoleFilter("all");
                  }}
                />
                <Chip
                  active={statusFilter === "active"}
                  label="Actifs"
                  count={cnt((m) => !m.isBanned && m.membershipStatus === "active")}
                  onClick={() =>
                    setStatusFilter((s) => (s === "active" ? "all" : "active"))
                  }
                />
                <Chip
                  active={statusFilter === "expiring"}
                  label="Expirent bientôt"
                  count={cnt((m) => {
                    const d = daysUntil(m.expiresAt);
                    return (
                      !m.isBanned &&
                      m.membershipStatus === "active" &&
                      d != null &&
                      d <= 21
                    );
                  })}
                  onClick={() =>
                    setStatusFilter((s) => (s === "expiring" ? "all" : "expiring"))
                  }
                />
                <Chip
                  active={statusFilter === "expired"}
                  label="Expirés"
                  count={cnt((m) => !m.isBanned && m.membershipStatus !== "active")}
                  onClick={() =>
                    setStatusFilter((s) => (s === "expired" ? "all" : "expired"))
                  }
                />
                <Chip
                  active={statusFilter === "inactive"}
                  label="Inactifs"
                  count={cnt((m) => {
                    const d = daysSince(m.lastLoginAt);
                    return (d == null || d > 30) && !m.isBanned;
                  })}
                  onClick={() =>
                    setStatusFilter((s) => (s === "inactive" ? "all" : "inactive"))
                  }
                />
                <Chip
                  active={roleFilter === "mentor"}
                  label="Mentors"
                  count={cnt((m) => m.role === "mentor")}
                  onClick={() =>
                    setRoleFilter((r) => (r === "mentor" ? "all" : "mentor"))
                  }
                />
                <Chip
                  active={statusFilter === "banned"}
                  label="Bannis"
                  count={cnt((m) => m.isBanned)}
                  onClick={() =>
                    setStatusFilter((s) => (s === "banned" ? "all" : "banned"))
                  }
                />
              </div>
            </section>

            {/* Grille */}
            {filtered.length > 0 ? (
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))",
                  gap: 18,
                }}
              >
                {filtered.map((m) => (
                  <MemberCard
                    key={m.id}
                    member={m}
                    offer={offerBySlug.get(m.currentOfferSlug ?? "")}
                    onOpen={() => {
                      setSelectedId(m.id);
                      setGrantPick(offers[0]?.slug ?? "");
                    }}
                  />
                ))}
              </section>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: "80px 20px",
                  color: "var(--color-text-muted)",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 12,
                    color: "var(--color-text-muted)",
                  }}
                >
                  <SearchX size={32} strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>
                  Aucun membre ne correspond à ces critères.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Drawer */}
      {selected && (
        <MemberDrawer
          member={selected}
          offers={offers}
          grantPick={grantPick}
          pending={pending}
          onGrantPick={setGrantPick}
          onClose={() => setSelectedId(null)}
          onChangeRole={changeRole}
          onToggleBan={toggleBan}
          onGrant={grant}
          onRevoke={revoke}
        />
      )}
    </>
  );
}

// ============================================================================
// Sous-composants
// ============================================================================

function Chip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="nc-press"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 14px",
        borderRadius: 100,
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "inherit",
        cursor: "pointer",
        border: `1px solid ${active ? "var(--color-brand)" : "var(--color-border-default)"}`,
        background: active ? "var(--color-brand)" : "var(--color-surface-card)",
        color: active ? "#fff" : "var(--color-text-secondary)",
        transition: "background .15s var(--nc-ease), border-color .15s var(--nc-ease), color .15s var(--nc-ease)",
      }}
    >
      {label}
      <span style={{ fontSize: 11, opacity: 0.7 }}>{count}</span>
    </button>
  );
}

function MemberCard({
  member: m,
  offer,
  onOpen,
}: {
  member: AdminMemberDetail;
  offer: AdminOfferOption | undefined;
  onOpen: () => void;
}) {
  const stt = statusOf(m);
  const showRole = m.role !== "member";
  const photo = m.avatarUrl;
  return (
    <button
      onClick={onOpen}
      className="nc-card-hov"
      style={{
        position: "relative",
        display: "block",
        padding: 0,
        border: "none",
        textAlign: "left",
        cursor: "pointer",
        borderRadius: 16,
        overflow: "hidden",
        background: "#2a2725",
        aspectRatio: "3 / 4",
        boxShadow: "0 1px 3px rgba(0,0,0,.12)",
        fontFamily: "inherit",
        transition: "transform .35s var(--nc-ease), box-shadow .35s var(--nc-ease)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: photo ? `center/cover no-repeat url(${photo})` : avatarBg(m.id),
          filter: m.isBanned ? "grayscale(1) brightness(.9)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!photo && (
          <span
            style={{
              fontSize: 54,
              fontWeight: 700,
              color: "rgba(255,255,255,.94)",
              letterSpacing: ".02em",
            }}
          >
            {m.initials}
          </span>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom,rgba(0,0,0,0) 38%,rgba(0,0,0,.35) 60%,rgba(0,0,0,.86) 100%)",
        }}
      />
      {/* top row */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <span
          style={{
            display: showRole ? "inline-flex" : "none",
            alignItems: "center",
            padding: "4px 9px",
            borderRadius: 100,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: ".02em",
            textTransform: "uppercase",
            background:
              m.role === "admin" ? "rgba(224,98,90,.9)" : "rgba(255,255,255,.85)",
            color: m.role === "admin" ? "#fff" : "#111",
            backdropFilter: "blur(6px)",
          }}
        >
          {roleLabel(m.role)}
        </span>
        <span
          title={stt.label}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,.16)",
            backdropFilter: "blur(6px)",
            marginLeft: "auto",
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: stt.color,
              boxShadow: `0 0 0 3px ${stt.halo}`,
            }}
          />
        </span>
      </div>
      {/* bottom info */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "14px 14px 13px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 15.5,
            fontWeight: 600,
            color: "#fff",
            lineHeight: 1.15,
            letterSpacing: "-.01em",
          }}
        >
          {m.name}
        </span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#fff",
              background: offerColor(m.currentOfferSlug, offer?.isPaid ?? false),
              padding: "3px 8px",
              borderRadius: 100,
            }}
          >
            {m.currentOfferName ?? "Aucune offre"}
          </span>
          <span
            style={{
              fontSize: 11.5,
              color: "rgba(255,255,255,.72)",
              fontWeight: 500,
            }}
          >
            Depuis {monthYear(m.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
}

function MemberDrawer({
  member: m,
  offers,
  grantPick,
  pending,
  onGrantPick,
  onClose,
  onChangeRole,
  onToggleBan,
  onGrant,
  onRevoke,
}: {
  member: AdminMemberDetail;
  offers: AdminOfferOption[];
  grantPick: string;
  pending: boolean;
  onGrantPick: (slug: string) => void;
  onClose: () => void;
  onChangeRole: (role: AdminMemberRole) => void;
  onToggleBan: () => void;
  onGrant: () => void;
  onRevoke: (membershipId: string) => void;
}) {
  const stt = statusOf(m);
  const dUntil = daysUntil(m.expiresAt);
  const expiryLabel = m.isBanned
    ? "Accès suspendu"
    : m.membershipStatus !== "active"
      ? "Abonnement expiré"
      : m.expiresAt == null
        ? "Accès à vie"
        : dUntil != null && dUntil <= 21
          ? `Expire dans ${dUntil} j`
          : `Renouvelé dans ${dUntil ?? 0} j`;

  const profileRows: Array<{ k: string; v: React.ReactNode }> = [
    { k: "Email", v: m.email ?? "—" },
    ...(m.communicationEmail && m.communicationEmail !== m.email
      ? [{ k: "Email de contact", v: m.communicationEmail }]
      : []),
    ...(m.phone ? [{ k: "Téléphone", v: m.phone }] : []),
    ...(m.company ? [{ k: "Entreprise", v: m.company }] : []),
    ...(m.city ? [{ k: "Ville", v: m.city }] : []),
    { k: "Email vérifié", v: <EmailVerifiedBadge verified={m.emailVerified} /> },
    { k: "Inscrit le", v: fullDate(m.createdAt) },
  ];

  const activeSlugs = new Set(
    m.memberships.filter((x) => x.status === "active").map((x) => x.offerSlug),
  );
  const grantOptions = offers.filter((o) => !activeSlugs.has(o.slug));
  const effectiveGrant = grantOptions.some((o) => o.slug === grantPick)
    ? grantPick
    : (grantOptions[0]?.slug ?? "");

  // Niveau 1 (journal d'activité) pas encore branché : on ne garde que les
  // agrégats réels (dernière connexion, appels, no-shows). `lastActiveAt` n'est
  // jamais alimenté → retiré de l'affichage (cf. activity-instrumentation-niveau1).
  const activityStats = [
    {
      label: "Dernière connexion",
      value: rel(daysSince(m.lastLoginAt)),
      color:
        (daysSince(m.lastLoginAt) ?? 9e9) > 30
          ? SEMANTIC.warning
          : "var(--color-text-primary)",
    },
    {
      label: "Appels coaching",
      value: String(m.callsCount),
      color: "var(--color-text-primary)",
    },
    {
      label: "No-shows",
      value: String(m.noShowsCount),
      color: m.noShowsCount > 0 ? SEMANTIC.danger : "var(--color-text-primary)",
    },
  ];

  const surface: React.CSSProperties = {
    background: "var(--color-surface-card)",
    border: "1px solid var(--color-border-default)",
    borderRadius: 16,
    padding: "16px 18px",
  };
  const roles: AdminMemberRole[] = ["member", "mentor", "admin"];

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(20,18,17,.45)",
          backdropFilter: "blur(2px)",
          animation: "ncFade .25s ease both",
        }}
      />
      <aside
        className="nc-scroll"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 1001,
          width: "min(480px,100%)",
          background: "var(--color-surface-page)",
          boxShadow: "-24px 0 60px -20px rgba(0,0,0,.4)",
          overflowY: "auto",
          animation: "ncSlideInRight .4s var(--nc-ease) both",
        }}
      >
        {/* Hero */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "relative",
              height: 170,
              overflow: "hidden",
              background: avatarBg(m.id),
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to bottom,rgba(0,0,0,.15),var(--color-surface-page) 100%)",
              }}
            />
            <button
              onClick={onClose}
              className="nc-press"
              aria-label="Fermer"
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,.9)",
                backdropFilter: "blur(6px)",
                cursor: "pointer",
                color: "#52525b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,.18)",
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div
            style={{
              padding: "0 24px",
              marginTop: -54,
              position: "relative",
              display: "flex",
              alignItems: "flex-end",
              gap: 16,
            }}
          >
            <div
              style={{
                position: "relative",
                width: 92,
                height: 92,
                borderRadius: 22,
                overflow: "hidden",
                border: "4px solid var(--color-surface-page)",
                boxShadow: "0 8px 22px -8px rgba(0,0,0,.4)",
                background: m.avatarUrl
                  ? `center/cover no-repeat url(${m.avatarUrl})`
                  : avatarBg(m.id),
                flex: "none",
                filter: m.isBanned ? "grayscale(1)" : "none",
              }}
            >
              {!m.avatarUrl && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 30,
                    fontWeight: 700,
                    color: "rgba(255,255,255,.95)",
                  }}
                >
                  {m.initials}
                </div>
              )}
            </div>
            <div
              style={{
                flex: 1,
                paddingBottom: 6,
                display: "flex",
                flexDirection: "column",
                gap: 5,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 21,
                    fontWeight: 700,
                    letterSpacing: "-.02em",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {m.name}
                </span>
                {m.isBanned && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#fff",
                      background: SEMANTIC.danger,
                      padding: "3px 9px",
                      borderRadius: 100,
                    }}
                  >
                    Banni
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: 13.5,
                  color: "var(--color-text-muted)",
                  fontWeight: 500,
                }}
              >
                {m.username ? `@${m.username}` : (m.email ?? "—")}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "22px 24px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* Rôle + statut */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                flex: 1,
                minWidth: 140,
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div style={uppercaseLabel}>Rôle</div>
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  background: "var(--color-surface-raised)",
                  padding: 3,
                  borderRadius: 100,
                }}
              >
                {roles.map((r) => {
                  const on = m.role === r;
                  return (
                    <button
                      key={r}
                      onClick={() => onChangeRole(r)}
                      disabled={pending}
                      className="nc-press"
                      style={{
                        flex: 1,
                        padding: "6px 4px",
                        border: "none",
                        borderRadius: 100,
                        fontFamily: "inherit",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: pending ? "wait" : "pointer",
                        background: on ? "var(--color-surface-card)" : "transparent",
                        color: on ? "var(--color-brand)" : "var(--color-text-muted)",
                        boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none",
                      }}
                    >
                      {roleLabel(r)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 140,
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div style={uppercaseLabel}>Statut accès</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: stt.color,
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {stt.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  marginTop: 4,
                }}
              >
                {expiryLabel}
              </div>
            </div>
          </div>

          {/* Profil */}
          <div style={surface}>
            <div style={sectionTitle}>
              <PersonCircleFill size={15} aria-hidden />
              Profil
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {profileRows.map((p, i) => (
                <div
                  key={p.k}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "9px 0",
                    borderTop:
                      i === 0 ? "none" : "1px solid var(--color-border-default)",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-muted)",
                      fontWeight: 500,
                    }}
                  >
                    {p.k}
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      color: "var(--color-text-primary)",
                      fontWeight: 500,
                      textAlign: "right",
                      wordBreak: "break-word",
                    }}
                  >
                    {p.v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div style={surface}>
            <div style={sectionTitle}>
              <Bell size={15} aria-hidden />
              Notifications
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}
            >
              <NotifIndicator
                Icon={Mail}
                label="Email"
                on={m.notifications.email}
              />
              <NotifIndicator
                Icon={IphoneRadiowaves}
                label="Push"
                on={m.notifications.push}
              />
              <NotifIndicator
                Icon={MessageCircle}
                label="WhatsApp"
                on={m.notifications.whatsapp}
              />
            </div>
          </div>

          {/* Paiements */}
          <div style={surface}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div style={{ ...sectionTitle, marginBottom: 0 }}>
                <CreditCard size={15} aria-hidden />
                Offres
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: "-.02em",
                    color: "var(--color-brand)",
                  }}
                >
                  {eur(m.totalPaidEur)}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--color-text-muted)",
                    fontWeight: 500,
                  }}
                >
                  encaissé · {m.memberships.length} offre
                  {m.memberships.length > 1 ? "s" : ""}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {m.memberships.length === 0 && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--color-text-muted)",
                    padding: "8px 2px",
                  }}
                >
                  Aucune offre enregistrée.
                </div>
              )}
              {m.memberships.map((p) => {
                const active = p.status === "active";
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 12px",
                      background: "var(--color-surface-raised)",
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          flexWrap: "wrap",
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {p.offerName}
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: 100,
                            background: active
                              ? "rgba(34,197,94,.14)"
                              : "var(--color-border-default)",
                            color: active ? SEMANTIC.successText : "var(--color-text-muted)",
                          }}
                        >
                          {active
                            ? "Actif"
                            : p.status === "cancelled"
                              ? "Révoqué"
                              : "Terminé"}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          color: "var(--color-text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {fullDate(p.startsAt)} · {sourceLabel(p.source)}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {p.priceEur > 0 ? eur(p.priceEur) : "—"}
                    </div>
                    {active && (
                      <button
                        onClick={() => onRevoke(p.id)}
                        disabled={pending}
                        className="nc-press"
                        title="Révoquer cette offre"
                        style={{
                          border: "1px solid var(--color-border-default)",
                          background: "var(--color-surface-card)",
                          color: SEMANTIC.danger,
                          borderRadius: 10,
                          padding: "6px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: pending ? "wait" : "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        Révoquer
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {grantOptions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <select
                  value={effectiveGrant}
                  onChange={(e) => onGrantPick(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border-default)",
                    borderRadius: 10,
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {grantOptions.map((o) => (
                    <option key={o.slug} value={o.slug}>
                      {o.name}
                      {o.priceEur > 0 ? ` · ${eur(o.priceEur)}` : ""}
                    </option>
                  ))}
                </select>
                <button
                  onClick={onGrant}
                  disabled={pending}
                  className="nc-press"
                  style={{
                    padding: "9px 16px",
                    background: "var(--color-brand)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: pending ? "wait" : "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: "0 6px 16px -8px rgba(224,98,90,.8)",
                  }}
                >
                  Accorder l&apos;offre
                </button>
              </div>
            )}
          </div>

          {/* Formations */}
          <div style={surface}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <div style={{ ...sectionTitle, marginBottom: 0 }}>
                <GraduationCap size={15} aria-hidden />
                Formations
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text-muted)",
                }}
              >
                {m.avgCompletion} % complété
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {m.formations.length === 0 && (
                <div
                  style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                >
                  Aucune formation disponible.
                </div>
              )}
              {m.formations.map((f) => {
                const c =
                  f.pct >= 100
                    ? SEMANTIC.successText
                    : f.pct > 0
                      ? "var(--color-brand)"
                      : "var(--color-text-muted)";
                return (
                  <div key={f.name}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "var(--color-text-primary)",
                        }}
                      >
                        {f.name}
                      </span>
                      <span
                        style={{ fontSize: 12, fontWeight: 600, color: c }}
                      >
                        {f.pct} %
                      </span>
                    </div>
                    <div
                      style={{
                        height: 7,
                        background: "var(--color-surface-raised)",
                        borderRadius: 100,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 100,
                          background: f.pct >= 100 ? SEMANTIC.success : "var(--color-brand)",
                          width: `${f.pct}%`,
                          transition: "width .6s var(--nc-ease)",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                        marginTop: 4,
                      }}
                    >
                      {f.pct === 0
                        ? "Pas encore commencée"
                        : f.pct >= 100
                          ? `Terminée · ${f.totalCourses} cours`
                          : `${f.completed} / ${f.totalCourses} cours`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activité */}
          <div style={surface}>
            <div style={sectionTitle}>
              <Activity size={15} aria-hidden />
              Activité
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {activityStats.map((a) => (
                <div
                  key={a.label}
                  style={{
                    background: "var(--color-surface-raised)",
                    borderRadius: 12,
                    padding: "12px 13px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {a.label}
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      letterSpacing: "-.01em",
                      color: a.color,
                    }}
                  >
                    {a.value}
                  </div>
                </div>
              ))}
            </div>
            {/* Journal d'activité — placeholder structuré pour la brique
                Niveau 1 (activity_events). Quand la table existe, ce bloc est
                remplacé par la liste réelle des sessions/events horodatés sans
                retoucher le layout du drawer. */}
            <ActivityJournalPlaceholder />
          </div>

          {/* Ban */}
          <button
            onClick={onToggleBan}
            disabled={pending}
            className="nc-press"
            style={{
              width: "100%",
              padding: 13,
              borderRadius: 12,
              fontFamily: "inherit",
              fontSize: 14,
              fontWeight: 600,
              cursor: pending ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: `1px solid ${m.isBanned ? "rgba(34,197,94,.4)" : "rgba(239,68,68,.35)"}`,
              background: m.isBanned ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.08)",
              color: m.isBanned ? SEMANTIC.successText : SEMANTIC.danger,
            }}
          >
            <PersonBadgeMinus size={16} aria-hidden />
            {m.isBanned ? "Débannir ce membre" : "Bannir ce membre"}
          </button>
        </div>
      </aside>
    </>
  );
}

// Badge « Email vérifié » (ticket 3c) — état vérifié distinct de non-vérifié.
function EmailVerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 100,
        background: verified ? "rgba(34,197,94,.12)" : "var(--color-surface-raised)",
        color: verified ? SEMANTIC.successText : "var(--color-text-muted)",
      }}
    >
      {verified ? (
        <CheckmarkSealText size={14} aria-hidden />
      ) : (
        <span
          aria-hidden
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--color-text-muted)",
          }}
        />
      )}
      {verified ? "Vérifié" : "Non vérifié"}
    </span>
  );
}

// Indicateur ON/OFF d'un canal de notification (lecture seule, ticket 3b).
function NotifIndicator({
  Icon,
  label,
  on,
}: {
  Icon: ComponentType<{ size?: number | string }>;
  label: string;
  on: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-raised)",
        borderRadius: 12,
        padding: "12px 13px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          color: on ? "var(--color-brand)" : "var(--color-text-muted)",
        }}
      >
        <Icon size={17} />
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 11.5,
            fontWeight: 600,
            color: on ? SEMANTIC.successText : "var(--color-text-muted)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: on ? SEMANTIC.success : "var(--color-text-muted)",
            }}
          />
          {on ? "Activé" : "Désactivé"}
        </span>
      </div>
    </div>
  );
}

// Placeholder de la section « Activité » (journal). La donnée Niveau 1
// (table activity_events) n'existe pas encore : on pose un empty-state plateforme
// avec une amorce de skeleton, prêt à être remplacé par la liste réelle.
function ActivityJournalPlaceholder() {
  return (
    <div
      style={{
        border: "1px dashed var(--color-border-default)",
        borderRadius: 12,
        padding: "16px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span
          aria-hidden
          style={{ display: "inline-flex", color: "var(--color-text-muted)" }}
        >
          <Activity size={15} />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            Journal d&apos;activité
          </span>
          <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
            Bientôt disponible
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {[78, 64, 52].map((w, i) => (
          <div
            key={w}
            className="nc-skeleton"
            style={{
              height: 9,
              width: `${w}%`,
              borderRadius: 100,
              animationDelay: `${i * 120}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const uppercaseLabel: React.CSSProperties = {
  fontSize: 11.5,
  color: "var(--color-text-muted)",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: ".03em",
  marginBottom: 8,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 12,
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--color-text-primary)",
};

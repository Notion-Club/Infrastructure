"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  sendAdminPushAction,
  type SendAdminPushInput,
} from "@/modules/admin/server/sendPushAction";
import {
  getAdminUrlTreeAction,
  listAdminMembersAction,
  type AdminMember,
  type UrlTreeNode,
} from "@/modules/admin/server/getAdminListsAction";

// Carte DevToolbox réservée aux administrateurs : envoie une Web Push à
// soi-même, à un set de membres explicitement choisis (multi-select avec
// avatars), ou à tous les abonnés actifs.
//
// Tous les pickers s'expandent INLINE (le panneau du DevToolbox ayant
// `overflow:hidden`, un dropdown imbriqué serait clippé) avec scroll local.

type Target = SendAdminPushInput["target"]["type"];

const TARGETS: Array<{ key: Target; label: string }> = [
  { key: "self", label: "Moi" },
  { key: "users", label: "Membres" },
  { key: "all", label: "Tous" },
];

const ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com", ".supabase.co"];

function isAllowedAvatarHost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return ALLOWED_IMAGE_HOSTS.some((h) =>
      h.startsWith(".") ? hostname.endsWith(h) : hostname === h,
    );
  } catch {
    return false;
  }
}

const PALETTE = [
  "#e0625a",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#64748b",
];

function colorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length]!;
}

export function AdminPushDevCard() {
  const [page, setPage] = useState<1 | 2>(1);
  const [target, setTarget] = useState<Target>("self");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [title, setTitle] = useState("Test Notion Club");
  const [body, setBody] = useState("Coucou, ceci est un test de notif.");
  const [url, setUrl] = useState("");
  const [urlLabel, setUrlLabel] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Mesure de hauteur dynamique sur la page active — épouse le contenu
  // sans saut visuel quand on passe du gros bouton (page 1) au formulaire
  // (page 2) ou inversement. Mirror du pattern FeedbackToolboxPanel.
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const [slideHeight, setSlideHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = page === 2 ? page2Ref.current : page1Ref.current;
    if (!el) return;
    const update = () => setSlideHeight(el.offsetHeight);
    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [page, target, selectedMemberIds, title, body, url, urlLabel, pending]);

  // Données pickers — chargées paresseusement quand on ouvre la carte la
  // première fois pour éviter les requêtes sur les rôles non-admin (la
  // carte est de toutes façons gated dans AdminPushRegistrar).
  const [members, setMembers] = useState<AdminMember[] | null>(null);
  const [urlTree, setUrlTree] = useState<UrlTreeNode[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAdminMembersAction(), getAdminUrlTreeAction()]).then(
      ([m, t]) => {
        if (cancelled) return;
        setMembers(m);
        setUrlTree(t);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSend() {
    if (!title.trim()) {
      toast.error("Le titre est obligatoire.");
      return;
    }
    if (target === "users" && selectedMemberIds.length === 0) {
      toast.error("Sélectionne au moins un membre.");
      return;
    }

    // Construit l'URL absolue à partir du chemin choisi dans l'arbre.
    // La route /api/push/send valide en `z.string().url()` → doit être
    // une URL complète.
    const absoluteUrl = url ? buildAbsoluteUrl(url) : undefined;

    const payload: SendAdminPushInput =
      target === "users"
        ? {
            target: { type: "users", userIds: selectedMemberIds },
            title: title.trim(),
            body: body.trim() || undefined,
            url: absoluteUrl,
          }
        : {
            target: { type: target },
            title: title.trim(),
            body: body.trim() || undefined,
            url: absoluteUrl,
          };

    startTransition(async () => {
      const result = await sendAdminPushAction(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const recipientsLabel =
        result.recipients > 1
          ? `${result.recipients} membres`
          : "1 membre";
      toast.success(
        `Push envoyée à ${recipientsLabel} : ${result.sent} OK, ${result.expired} expiré, ${result.failed} échec.`,
      );
    });
  }

  return (
    <div data-fb-label="Outils admin · Notif push">
      <div
        className="t-page-slide"
        data-page={page}
        style={{
          height: slideHeight,
          transition: "height 240ms var(--nc-ease)",
          overflow: "hidden",
        }}
      >
        {/* ── Page 1 — déclencheur compact (gros bouton icône) ── */}
        <section ref={page1Ref} className="t-page" data-page-id="1">
          <button
            type="button"
            onClick={() => setPage(2)}
            data-fb-label="Ouvrir composer · Notif push"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "12px 8px",
              borderRadius: 12,
              border: "1px solid var(--color-border-default)",
              background: "var(--color-surface-raised)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
              transition: "background var(--nc-duration-xfast) var(--nc-ease), border-color var(--nc-duration-xfast) var(--nc-ease)",
            }}
            className="hover:border-[rgba(224,98,90,0.35)] hover:bg-[rgba(224,98,90,0.06)]"
          >
            <span
              style={{ color: "var(--color-brand)", display: "inline-flex" }}
            >
              <Bell size={18} strokeWidth={1.8} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 500 }}>Notif push</span>
          </button>
        </section>

        {/* ── Page 2 — formulaire complet ── */}
        <section ref={page2Ref} className="t-page" data-page-id="2">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setPage(1)}
              aria-label="Retour"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid var(--color-border-default)",
                background: "var(--color-surface-card)",
                color: "var(--color-text-primary)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <ArrowLeft size={15} />
            </button>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-primary)",
              }}
            >
              Envoyer une notif push
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "0 4px",
            }}
          >
            {/* ── Cible ────────────────────────────────────────────────── */}
        <Field label="Cible">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 4,
            }}
          >
            {TARGETS.map((t) => {
              const active = t.key === target;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTarget(t.key)}
                  style={{
                    padding: "6px 8px",
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    color: active ? "#fff" : "var(--color-text-primary)",
                    background: active
                      ? "var(--color-brand)"
                      : "var(--color-surface-raised)",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "background var(--nc-duration-xfast) var(--nc-ease)",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>

        {/* ── Membres (multi-select) ──────────────────────────────── */}
        {target === "users" && (
          <Field label={`Membres${selectedMemberIds.length > 0 ? ` · ${selectedMemberIds.length} sélectionné${selectedMemberIds.length > 1 ? "s" : ""}` : ""}`}>
            <MemberPicker
              members={members}
              selectedIds={selectedMemberIds}
              onChange={setSelectedMemberIds}
            />
          </Field>
        )}

        {/* ── Titre ───────────────────────────────────────────────── */}
        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="nc-input"
            style={inputStyle}
          />
        </Field>

        {/* ── Message ─────────────────────────────────────────────── */}
        <Field label="Message">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
            rows={2}
            className="nc-input"
            style={{ ...inputStyle, resize: "vertical", minHeight: 52 }}
          />
        </Field>

        {/* ── URL (picker fil d'Ariane) ────────────────────────────── */}
        <Field label="URL de destination (optionnel)">
          <UrlPicker
            tree={urlTree}
            selectedUrl={url}
            selectedLabel={urlLabel}
            onSelect={(u, label) => {
              setUrl(u);
              setUrlLabel(label);
            }}
            onClear={() => {
              setUrl("");
              setUrlLabel(null);
            }}
          />
        </Field>

        <button
          type="button"
          onClick={handleSend}
          disabled={pending}
          style={{
            marginTop: 4,
            padding: "10px 12px",
            fontSize: 13.5,
            fontWeight: 600,
            color: "#fff",
            background: pending
              ? "color-mix(in srgb, var(--color-brand) 60%, transparent)"
              : "var(--color-brand)",
            border: "none",
            borderRadius: 10,
            cursor: pending ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "background var(--nc-duration-xfast) var(--nc-ease)",
          }}
        >
          {pending ? (
            <>
              <LoaderCircle size={14} className="animate-spin" />
              Envoi…
            </>
          ) : (
            <>
              <Send size={14} />
              Envoyer
            </>
          )}
        </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-text-secondary)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// ── MemberPicker ────────────────────────────────────────────────────────────

function MemberPicker({
  members,
  selectedIds,
  onChange,
}: {
  members: AdminMember[] | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedMembers = useMemo(
    () => (members ?? []).filter((m) => selectedSet.has(m.id)),
    [members, selectedSet],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members ?? [];
    return (members ?? []).filter((m) => m.name.toLowerCase().includes(q));
  }, [members, search]);

  function toggle(id: string) {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 10,
        padding: 6,
      }}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "4px 6px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
          borderRadius: 8,
        }}
        className="hover:bg-[var(--color-surface-raised)]"
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={14} style={{ color: "var(--color-text-muted)" }} />
          <span style={{ fontSize: 12.5, color: "var(--color-text-primary)" }}>
            {selectedMembers.length === 0
              ? "Choisir des membres"
              : `${selectedMembers.length} sélectionné${selectedMembers.length > 1 ? "s" : ""}`}
          </span>
        </span>
        <ChevronDown
          size={14}
          style={{
            color: "var(--color-text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 180ms var(--nc-ease)",
          }}
        />
      </button>

      {/* Chips des sélectionnés (toujours visible quand il y en a) */}
      {selectedMembers.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            padding: "0 4px 2px",
          }}
        >
          {selectedMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              title="Retirer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 6px 2px 2px",
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 999,
                cursor: "pointer",
                fontSize: 11.5,
              }}
            >
              <AvatarCircle member={m} size={18} />
              <span
                style={{
                  maxWidth: 110,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "var(--color-text-primary)",
                }}
              >
                {m.name}
              </span>
              <X size={11} style={{ color: "var(--color-text-muted)" }} />
            </button>
          ))}
        </div>
      )}

      {/* Liste */}
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            borderTop: "1px solid var(--color-border-default)",
            paddingTop: 6,
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="nc-input"
            style={{ ...inputStyle, padding: "6px 8px" }}
            spellCheck={false}
          />
          <div
            role="listbox"
            style={{
              maxHeight: 200,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {members === null && (
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  textAlign: "center",
                }}
              >
                Chargement…
              </div>
            )}
            {members !== null && filtered.length === 0 && (
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  color: "var(--color-text-muted)",
                  textAlign: "center",
                }}
              >
                Aucun membre.
              </div>
            )}
            {filtered.map((m) => {
              const selected = selectedSet.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => toggle(m.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    border: "none",
                    background: selected
                      ? "color-mix(in srgb, var(--color-brand) 8%, transparent)"
                      : "transparent",
                    borderRadius: 8,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  className="hover:bg-[var(--color-surface-raised)]"
                >
                  <AvatarCircle member={m} size={26} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12.5,
                      fontWeight: selected ? 600 : 500,
                      color: "var(--color-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      border: selected
                        ? "1px solid var(--color-brand)"
                        : "1px solid var(--color-border-default)",
                      background: selected ? "var(--color-brand)" : "#fff",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarCircle({ member, size }: { member: AdminMember; size: number }) {
  const fs = Math.round(size * 0.4);
  const useImage = member.avatarUrl && isAllowedAvatarHost(member.avatarUrl);

  if (useImage) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <Image
          src={member.avatarUrl!}
          alt={member.name}
          width={size}
          height={size}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: member.avatarColor ?? colorFromId(member.id),
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: fs,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {member.initials}
    </div>
  );
}

// ── UrlPicker ───────────────────────────────────────────────────────────────

function UrlPicker({
  tree,
  selectedUrl,
  selectedLabel,
  onSelect,
  onClear,
}: {
  tree: UrlTreeNode[] | null;
  selectedUrl: string;
  selectedLabel: string | null;
  onSelect: (url: string, label: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 10,
        padding: 6,
      }}
    >
      {/* Trigger */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "4px 6px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            textAlign: "left",
            borderRadius: 8,
            minWidth: 0,
          }}
          className="hover:bg-[var(--color-surface-raised)]"
        >
          <span
            style={{
              fontSize: 12.5,
              color: selectedUrl
                ? "var(--color-text-primary)"
                : "var(--color-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {selectedLabel ?? "Choisir une page"}
          </span>
          <ChevronDown
            size={14}
            style={{
              color: "var(--color-text-muted)",
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 180ms var(--nc-ease)",
            }}
          />
        </button>
        {selectedUrl && (
          <button
            type="button"
            onClick={onClear}
            title="Effacer"
            style={{
              padding: 4,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-text-muted)",
            }}
            className="hover:text-[var(--color-text-primary)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tree */}
      {open && (
        <div
          style={{
            maxHeight: 240,
            overflowY: "auto",
            borderTop: "1px solid var(--color-border-default)",
            paddingTop: 6,
          }}
        >
          {tree === null && (
            <div
              style={{
                padding: 10,
                fontSize: 12,
                color: "var(--color-text-muted)",
                textAlign: "center",
              }}
            >
              Chargement…
            </div>
          )}
          {tree !== null &&
            tree.map((node) => (
              <UrlNode
                key={node.id}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpand}
                onSelect={(url, label) => {
                  onSelect(url, label);
                  setOpen(false);
                }}
                selectedUrl={selectedUrl}
                breadcrumb={[]}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function UrlNode({
  node,
  depth,
  expanded,
  onToggle,
  onSelect,
  selectedUrl,
  breadcrumb,
}: {
  node: UrlTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (url: string, label: string) => void;
  selectedUrl: string;
  breadcrumb: string[];
}) {
  const hasChildren = !!node.children && node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const trail = [...breadcrumb, node.label];
  const isSelected = node.url === selectedUrl;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          paddingLeft: depth * 10,
        }}
      >
        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={isExpanded ? "Replier" : "Déplier"}
            style={{
              width: 18,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ChevronRight
              size={12}
              style={{
                transform: isExpanded ? "rotate(90deg)" : "none",
                transition: "transform 180ms var(--nc-ease)",
              }}
            />
          </button>
        )}
        {!hasChildren && <span style={{ width: 18 }} />}
        <button
          type="button"
          onClick={() => {
            if (node.url) onSelect(node.url, trail.join(" › "));
          }}
          disabled={!node.url}
          style={{
            flex: 1,
            padding: "5px 6px",
            border: "none",
            background: isSelected
              ? "color-mix(in srgb, var(--color-brand) 8%, transparent)"
              : "transparent",
            cursor: node.url ? "pointer" : "default",
            textAlign: "left",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: isSelected ? 600 : 500,
            color: node.url
              ? "var(--color-text-primary)"
              : "var(--color-text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          className={node.url ? "hover:bg-[var(--color-surface-raised)]" : undefined}
        >
          {node.label}
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <UrlNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedUrl={selectedUrl}
              breadcrumb={trail}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function buildAbsoluteUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://app.notionclub.fr";
  return `${origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13.5,
  borderRadius: 8,
};

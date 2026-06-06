"use client";

// Section « retours » affichée en haut du dropdown de la toolbox dev.
//
// Page 1 — trois icônes : retour sur un élément · feedback général · voir les
//          brouillons & tickets envoyés.
// Page 2 — brouillons en attente (+ envoi) puis tickets envoyés.
//
// Navigation page 1 ⇄ page 2 via l'animation side-by-side (transitions.dev,
// classes .t-page-slide / .t-page). La hauteur du conteneur s'anime sur la
// page active pour épouser son contenu.

import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  MousePointer,
  Globe,
  LayoutGrid,
  ArrowLeft,
  Send,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import styles from "./FeedbackWidget.module.css";
import { useTheme } from "@/shared/lib/hooks/useTheme";
import { useDevToolboxClose } from "@/shared/components/dev/DevToolbox";
import type { Draft, NotionTicket } from "./types";

const TEXT_CLAMP = 160;

type StatusColors = {
  dot: string;
  bg: string;
  textLight: string;
  textDark: string;
  cssClass: string;
};
const STATUS_COLORS: Record<string, StatusColors> = {
  "À traiter": { dot: "#f59e0b", bg: "rgba(245,158,11,0.08)", textLight: "#92400e", textDark: "#fbbf24", cssClass: styles.statusPending },
  "En cours": { dot: "#3b82f6", bg: "rgba(59,130,246,0.08)", textLight: "#1e40af", textDark: "#60a5fa", cssClass: styles.statusProgress },
  "Traité": { dot: "#10b981", bg: "rgba(16,185,129,0.08)", textLight: "#065f46", textDark: "#34d399", cssClass: styles.statusDone },
  "Résolu": { dot: "#10b981", bg: "rgba(16,185,129,0.08)", textLight: "#065f46", textDark: "#34d399", cssClass: styles.statusDone },
  "Refusé": { dot: "#e0625a", bg: "rgba(224,98,90,0.08)", textLight: "#9a3a35", textDark: "#e0625a", cssClass: styles.statusRefused },
};

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > TEXT_CLAMP;
  return (
    <div>
      <p className={styles.feedbackText}>
        {isLong && !expanded ? `${text.slice(0, TEXT_CLAMP)}…` : text}
      </p>
      {isLong && (
        <button className={styles.expandBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Voir moins" : "Voir plus"}
        </button>
      )}
    </div>
  );
}

interface FeedbackToolboxPanelProps {
  onElement: () => void;
  onGeneral: () => void;
  drafts: Draft[];
  notionTickets: NotionTicket[];
  loadingTickets: boolean;
  ticketsError: string | null;
  deletingId: string | null;
  isSending: boolean;
  onEditDraft: (d: Draft) => void;
  onDeleteDraft: (id: string) => void;
  onSend: () => void;
  onRefreshTickets: () => void;
  onDeleteTicket: (id: string) => void;
}

export function FeedbackToolboxPanel({
  onElement,
  onGeneral,
  drafts,
  notionTickets,
  loadingTickets,
  ticketsError,
  deletingId,
  isSending,
  onEditDraft,
  onDeleteDraft,
  onSend,
  onRefreshTickets,
  onDeleteTicket,
}: FeedbackToolboxPanelProps) {
  const requestClose = useDevToolboxClose();
  const { theme } = useTheme();
  const [page, setPage] = useState<1 | 2>(1);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const slideRef = useRef<HTMLDivElement>(null);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  // Hauteur animée sur la page active (épouse le contenu, sans saut).
  useEffect(() => {
    const el = page === 2 ? page2Ref.current : page1Ref.current;
    if (!el) return;
    const update = () => setHeight(el.offsetHeight);
    const raf = requestAnimationFrame(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [page, drafts, notionTickets, loadingTickets, ticketsError, isSending]);

  const pendingCount = drafts.length;

  function StatusBadge({ status }: { status: string }) {
    const s =
      STATUS_COLORS[status] ?? {
        dot: "#9CA3AF",
        bg: "rgba(156,163,175,0.1)",
        textLight: "#6B7280",
        textDark: "#94a3b8",
        cssClass: styles.statusDefault,
      };
    return (
      <span
        className={`${styles.statusBadge} ${s.cssClass}`}
        style={{ background: s.bg, color: theme === "dark" ? s.textDark : s.textLight }}
      >
        <span className={styles.statusDot} style={{ background: s.dot }} />
        {status}
      </span>
    );
  }

  return (
    <div data-feedback-widget="true">
      <div
        ref={slideRef}
        className="t-page-slide"
        data-page={page}
        style={{
          height,
          transition: "height 240ms var(--nc-ease)",
          overflow: "hidden",
        }}
      >
        {/* ── Page 1 — icônes ── */}
        <section ref={page1Ref} className="t-page" data-page-id="1">
          <div style={{ display: "flex", gap: 8 }}>
            <ToolboxIcon
              icon={<MousePointer size={18} strokeWidth={1.8} />}
              label="Élément"
              onClick={() => {
                requestClose();
                onElement();
              }}
            />
            <ToolboxIcon
              icon={<Globe size={18} strokeWidth={1.8} />}
              label="Général"
              onClick={() => {
                requestClose();
                onGeneral();
              }}
            />
            <ToolboxIcon
              icon={<LayoutGrid size={18} strokeWidth={1.8} />}
              label="Tickets"
              badge={pendingCount > 0 ? pendingCount : undefined}
              onClick={() => setPage(2)}
            />
          </div>
        </section>

        {/* ── Page 2 — brouillons + tickets ── */}
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
              Brouillons & tickets
            </span>
            <button
              type="button"
              onClick={onRefreshTickets}
              disabled={loadingTickets}
              aria-label="Rafraîchir"
              title="Rafraîchir"
              style={{
                marginLeft: "auto",
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid var(--color-border-default)",
                background: "var(--color-surface-card)",
                color: "var(--color-text-muted)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: loadingTickets ? "wait" : "pointer",
                flexShrink: 0,
              }}
            >
              <RefreshCw size={13} className={loadingTickets ? styles.spinning : ""} />
            </button>
          </div>

          <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Brouillons en attente */}
            {drafts.length > 0 && (
              <div>
                <p className={styles.listHeading}>
                  Brouillons <span className={styles.listCount}>{drafts.length}</span>
                </p>
                <ul className={styles.list}>
                  {drafts.map((draft) => (
                    <li key={draft.id} className={styles.feedbackItem}>
                      <div className={styles.feedbackItemRow}>
                        <span className={styles.actionTag}>
                          {draft.isGeneral ? "Général" : draft.action}
                        </span>
                        {draft.end && <span className={styles.actionTag}>{draft.end}</span>}
                        <div className={styles.draftMenu}>
                          <button
                            className={styles.menuTrigger}
                            onClick={() =>
                              setMenuOpenId(menuOpenId === draft.id ? null : draft.id)
                            }
                            aria-label="Options"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {menuOpenId === draft.id && (
                            <div className={styles.menuDropdown}>
                              <button
                                className={styles.menuItem}
                                onClick={() => {
                                  setMenuOpenId(null);
                                  onEditDraft(draft);
                                }}
                              >
                                <Pencil size={13} /> Modifier
                              </button>
                              <button
                                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                                onClick={() => {
                                  setMenuOpenId(null);
                                  onDeleteDraft(draft.id);
                                }}
                              >
                                <Trash2 size={13} /> Supprimer
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className={styles.feedbackElement}>{draft.element}</p>
                      <ExpandableText text={draft.text} />
                    </li>
                  ))}
                </ul>
                <button
                  className={styles.sendBtn}
                  onClick={onSend}
                  disabled={isSending}
                  aria-busy={isSending}
                >
                  {isSending ? (
                    "Envoi en cours..."
                  ) : (
                    <>
                      <Send size={14} />
                      Envoyer {drafts.length} retour{drafts.length > 1 ? "s" : ""}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Tickets envoyés */}
            <div>
              <p className={styles.listHeading}>
                Retours envoyés
                {!loadingTickets && notionTickets.length > 0 && (
                  <span className={`${styles.listCount} ${styles.listCountNotion}`}>
                    {notionTickets.length}
                  </span>
                )}
              </p>

              {loadingTickets && notionTickets.length === 0 && (
                <p className={styles.loadingText}>Chargement des tickets...</p>
              )}
              {!loadingTickets && ticketsError && (
                <p className={styles.errorSmall}>{ticketsError}</p>
              )}
              {!loadingTickets && !ticketsError && notionTickets.length === 0 && (
                <p className={styles.emptySmall}>Aucun ticket envoyé pour l&apos;instant.</p>
              )}

              {notionTickets.length > 0 && (
                <ul className={styles.list}>
                  {notionTickets.map((ticket) => (
                    <li key={ticket.notionId} className={`${styles.feedbackItem} ${styles.notionItem}`}>
                      <div className={styles.notionItemHeader}>
                        <p className={styles.feedbackElement}>{ticket.element || "Sans titre"}</p>
                        <button
                          className={`${styles.menuTrigger} ${styles.menuTriggerDanger}`}
                          onClick={() => onDeleteTicket(ticket.notionId)}
                          disabled={deletingId === ticket.notionId}
                          aria-label="Supprimer ce ticket"
                          title="Supprimer de Notion"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {ticket.text && <ExpandableText text={ticket.text} />}
                      <div className={styles.notionItemFooter}>
                        {ticket.action && <span className={styles.actionTag}>{ticket.action}</span>}
                        <StatusBadge status={ticket.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ToolboxIcon({
  icon,
  label,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-fb-label={`Action retour « ${label} » · Outils dev`}
      style={{
        flex: 1,
        position: "relative",
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
        transition: "background 150ms ease, border-color 150ms ease",
      }}
      className="hover:border-[rgba(224,98,90,0.35)] hover:bg-[rgba(224,98,90,0.06)]"
    >
      <span style={{ color: "var(--color-brand)", display: "inline-flex" }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
      {badge !== undefined && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 9999,
            background: "var(--color-brand)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

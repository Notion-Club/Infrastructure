"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useDropdownTransition } from "@/shared/lib/hooks/useDropdownTransition";
import { Bell } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import type { Notification } from "../../types/notification.types";
import { timeAgo } from "../../utils/date-helpers";

const NOTIF_LABELS: Record<Notification["type"], string> = {
  mention_post: "t'a mentionné dans",
  mention_comment: "t'a mentionné dans",
  comment_on_post: "a commenté ton post",
  reply_to_comment: "a répondu à ton commentaire",
  reaction_on_post: "a réagi à ton post",
  new_dm: "t'a envoyé un message",
  admin_annonce: "a publié une annonce",
};

// Onglets du centre — chaque catégorie a son icône SVG (public/icons-notion).
// Les SVG sont posés en masque CSS (.t-tab-icon) → recolorés par currentColor,
// donc ils suivent l'état actif/inactif de l'onglet.
type TabKey = "unread" | "read" | "all";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "unread", label: "Non-lues", icon: "/icons-notion/bell-notification_lightgray.svg" },
  { key: "read", label: "Lues", icon: "/icons-notion/checkmark_lightgray.svg" },
  { key: "all", label: "Toutes", icon: "/icons-notion/list_lightgray.svg" },
];

const ARCHIVE_ICON = "/icons-notion/archive_lightgray.svg";
const CHECK_ICON = "/icons-notion/checkmark_lightgray.svg";

// Durée de la collapse d'une carte qui quitte la liste (cale sur la transition
// max-height de .nc-notif-card dans globals.css).
const EXIT_MS = 300;

const EMPTY_COPY: Record<TabKey, { title: string; sub: string }> = {
  unread: {
    title: "Aucune notification non lue",
    sub: "Tu es à jour — rien de nouveau à lire.",
  },
  read: {
    title: "Aucune notification lue",
    sub: "Les notifications que tu lis apparaîtront ici.",
  },
  all: {
    title: "Aucune notification pour le moment",
    sub: "Mentions, réponses et messages s'afficheront ici.",
  },
};

interface NotificationPopoverProps {
  buttonClassName?: string;
  /**
   * Contexte d'affichage du bouton trigger :
   * - "topbar" (défaut) : bouton transparent rond 40px, badge coin haut-droit
   *   avec bord blanc (look Topbar desktop).
   * - "mobile" : le bouton est entièrement stylé par la class
   *   `nc-mobile-action-btn` (frosted glass) — on n'applique aucun style inline
   *   de layout/fond qui l'écraserait, et le badge prend le look brand mobile.
   */
  variant?: "topbar" | "mobile";
}

export function NotificationPopover({
  buttonClassName,
  variant = "topbar",
}: NotificationPopoverProps) {
  const isMobile = variant === "mobile";
  const router = useRouter();
  const { isOpen, isMounted, stateClass, close, toggle } = useDropdownTransition();
  const {
    notifications: notifs,
    unreadCount: unread,
    markAsRead,
    markAllRead,
    archive,
  } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  // Onglet actif + cartes en cours de sortie (collapse animé avant retrait).
  const [tab, setTab] = useState<TabKey>("unread");
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  // Pilule glissante des onglets (transitions.dev — sliding tabs). On mesure
  // offsetLeft/offsetWidth de l'onglet actif et on l'écrit inline ; le CSS
  // possède le tween. `tween` reste false au 1ᵉʳ paint pour que la pilule
  // SNAPPE sur sa position initiale au lieu de glisser depuis width:0.
  const tabsBarRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [tween, setTween] = useState(false);

  const measurePill = useCallback(() => {
    const el = tabRefs.current[tab];
    if (!el) return;
    setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab]);

  useLayoutEffect(() => {
    if (!isMounted) return;
    measurePill();
  }, [isMounted, tab, measurePill]);

  useEffect(() => {
    if (!isMounted) return;
    // tween reste false au tout 1ᵉʳ paint (snap), puis on l'active au frame
    // suivant pour que les changements d'onglet ultérieurs glissent.
    const id = requestAnimationFrame(() => setTween(true));
    window.addEventListener("resize", measurePill);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measurePill);
    };
  }, [isMounted, measurePill]);

  // Click-outside.
  useEffect(() => {
    if (!isOpen) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isOpen, close]);

  // Retire une carte avec collapse animé, puis applique le commit (mark read
  // depuis l'onglet Non-lues, ou archivage). On garde la carte montée le temps
  // de l'anim : les suivantes remontent pour combler le vide.
  const animateOut = useCallback((id: string, commit: () => void) => {
    setLeaving((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      commit();
      setLeaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, EXIT_MS);
  }, []);

  function handleNotifClick(n: Notification) {
    markAsRead(n.id);
    if (n.conversationId) {
      // Le segment accepte un convId : MessagesLayout résout la conv puis
      // normalise l'URL vers /messages/<username>.
      router.push(`/communaute/messages/${n.conversationId}`);
    } else if (n.postId) {
      router.push(`/communaute/post/${n.postId}`);
    }
    close();
  }

  function handleMarkRead(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    if (n.read || leaving.has(n.id)) return;
    // Depuis l'onglet Non-lues, la carte quitte la liste → on l'anime.
    if (tab === "unread") {
      animateOut(n.id, () => markAsRead(n.id));
    } else {
      markAsRead(n.id);
    }
  }

  function handleArchive(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    if (leaving.has(n.id)) return;
    animateOut(n.id, () => archive(n.id));
  }

  const visible = notifs.filter((n) =>
    tab === "unread" ? !n.read : tab === "read" ? n.read : true,
  );
  const empty = EMPTY_COPY[tab];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={unread > 0 ? `${unread} notifications` : "Notifications"}
        onClick={() => toggle()}
        data-fb-label="Bouton Notifications · Communauté"
        className={buttonClassName}
        style={
          isMobile
            ? // Le look (taille, fond frosted, bordure, shadow) vient de la
              // class nc-mobile-action-btn — on n'écrase que la couleur d'icône.
              { color: "var(--color-text-secondary)" }
            : {
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "none",
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "var(--color-text-secondary)",
                position: "relative",
                flexShrink: 0,
                transition: "background 150ms ease",
              }
        }
      >
        <Bell size={isMobile ? 16 : 18} />
        {unread > 0 && (
          <span
            style={
              isMobile
                ? {
                    position: "absolute",
                    top: -2,
                    right: -2,
                    minWidth: 17,
                    height: 17,
                    background: "var(--color-brand)",
                    color: "white",
                    borderRadius: 9999,
                    fontSize: 10,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid white",
                    padding: "0 3px",
                    lineHeight: 1,
                  }
                : {
                    position: "absolute",
                    top: 2,
                    right: 2,
                    minWidth: 15,
                    height: 15,
                    background: "#e0625a",
                    color: "white",
                    borderRadius: 9999,
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1.5px solid white",
                    padding: "0 3px",
                    lineHeight: 1,
                  }
            }
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {isMounted && (
        <div
          data-fb-label="Popover notifications · Communauté"
          className={`t-dropdown ${stateClass}`}
          data-origin="top-right"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 360,
            maxHeight: 480,
            overflowY: "auto",
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 16,
            boxShadow: "var(--nc-shadow-2)",
            zIndex: 200,
          }}
        >
          {/* Header + onglets — collés en haut pendant le scroll de la liste. */}
          <div
            style={{
              position: "sticky",
              top: 0,
              background: "var(--color-surface-card)",
              borderBottom: "1px solid var(--color-border-default)",
              zIndex: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px 10px",
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text-primary)" }}>
                Notifications
              </span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  data-fb-label="Bouton Tout marquer comme lu · Popover notifications"
                  style={{
                    fontSize: 12,
                    color: "var(--color-brand)",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>

            {/* Segmented control à pilule glissante (transitions.dev). */}
            <div
              ref={tabsBarRef}
              role="tablist"
              aria-label="Filtre des notifications"
              className="t-tabs"
              style={{ margin: "0 16px 12px" }}
            >
              <span
                className="t-tabs-pill"
                aria-hidden="true"
                style={{
                  transform: `translateX(${pill.left}px)`,
                  width: pill.width,
                  transition: tween ? undefined : "none",
                }}
              />
              {TABS.map((t) => (
                <button
                  key={t.key}
                  ref={(el) => {
                    tabRefs.current[t.key] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  data-fb-label={`Onglet ${t.label} · Popover notifications`}
                  className="t-tab"
                >
                  <span
                    className="t-tab-icon"
                    aria-hidden="true"
                    style={{
                      WebkitMaskImage: `url(${t.icon})`,
                      maskImage: `url(${t.icon})`,
                    }}
                  />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div>
            {visible.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  padding: "36px 16px",
                  textAlign: "center",
                }}
              >
                <Bell size={26} color="var(--color-text-muted)" strokeWidth={1.5} />
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>
                  {empty.title}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>
                  {empty.sub}
                </p>
              </div>
            )}
            {visible.map((n) => (
              <div
                key={n.id}
                className={`nc-notif-card ${leaving.has(n.id) ? "is-leaving" : ""}`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotifClick(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotifClick(n);
                    }
                  }}
                  data-fb-label="Carte notification · Popover notifications"
                  className="hover:bg-[rgba(0,0,0,0.03)]"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "12px 16px",
                    background: n.read ? "transparent" : "#fef9f8",
                    borderBottom: "1px solid var(--color-border-default)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 150ms ease",
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {n.actorAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={n.actorAvatar}
                        alt={n.actorName}
                        style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: n.actorAvatarColor ?? "#e0625a",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fff",
                        }}
                      >
                        {n.actorInitials}
                      </div>
                    )}
                    {!n.read && (
                      <span
                        style={{
                          position: "absolute",
                          top: 0,
                          right: -2,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--color-brand)",
                          border: "1.5px solid white",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-primary)", lineHeight: 1.4 }}>
                      <strong>{n.actorName}</strong>{" "}
                      {NOTIF_LABELS[n.type]}{" "}
                      {n.excerpt && (
                        <span style={{ color: "var(--color-text-secondary)" }}>
                          &ldquo;{n.excerpt.slice(0, 40)}{n.excerpt.length > 40 ? "…" : ""}&rdquo;
                        </span>
                      )}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--color-text-muted)" }}>
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>

                  {/* Actions : marquer comme lu (si non lue) + archiver. */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    {!n.read && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkRead(e, n)}
                        aria-label="Marquer comme lu"
                        title="Marquer comme lu"
                        data-fb-label="Bouton Marquer comme lu · Carte notification"
                        className="nc-notif-action"
                      >
                        <span
                          className="nc-notif-action-icon"
                          aria-hidden="true"
                          style={{
                            WebkitMaskImage: `url(${CHECK_ICON})`,
                            maskImage: `url(${CHECK_ICON})`,
                          }}
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleArchive(e, n)}
                      aria-label="Archiver"
                      title="Archiver"
                      data-fb-label="Bouton Archiver · Carte notification"
                      className="nc-notif-action"
                    >
                      <span
                        className="nc-notif-action-icon"
                        aria-hidden="true"
                        style={{
                          WebkitMaskImage: `url(${ARCHIVE_ICON})`,
                          maskImage: `url(${ARCHIVE_ICON})`,
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

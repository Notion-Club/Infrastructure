"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import { canDMUser } from "../../utils/dm-rules";
import { joinedAgo } from "../../utils/date-helpers";
import { UserAvatar } from "./UserAvatar";

interface UserHoverCardProps {
  user: User;
  devRole: DevRole;
  children: React.ReactNode;
}

const CARD_W = 240;

// Position fixed calculée à partir du déclencheur. On stocke soit top (carte
// sous le déclencheur) soit bottom (carte au-dessus), jamais les deux.
type Coords = { left: number; top?: number; bottom?: number };

export function UserHoverCard({ user, devRole, children }: UserHoverCardProps) {
  const router = useRouter();
  const viewer = useCurrentUser(devRole);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<Coords>({ left: 0, top: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Clamp horizontal : la carte ne déborde jamais du viewport.
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - CARD_W - 8));
      // Bascule au-dessus si le bas du déclencheur est trop proche du bas d'écran.
      const above = rect.bottom > window.innerHeight - 200;
      setCoords(
        above
          ? { left, bottom: window.innerHeight - rect.top + 6 }
          : { left, top: rect.bottom + 6 },
      );
      setVisible(true);
    }, 300);
  }, []);

  // Fermeture différée (léger délai pour pouvoir traverser le petit écart de 6px
  // entre le déclencheur et la carte sans qu'elle se referme).
  const hide = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 150);
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Sensibilité : dès que la page défile ou est redimensionnée, la carte (en
  // position fixed) se décrocherait du déclencheur → on la ferme immédiatement.
  // Corrige aussi le ressenti « la carte reste active alors que je ne suis plus
  // sur la photo » quand on scrolle en laissant le curseur sur le fil.
  useEffect(() => {
    if (!visible) return;
    const close = () => {
      clearTimers();
      setVisible(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [visible, clearTimers]);

  const canDM = canDMUser(viewer, user);

  function handleDM(e: React.MouseEvent) {
    e.stopPropagation();
    // Deep-link par username (fallback id si absent, défensif).
    router.push(`/communaute/messages/${user.username ?? user.id}`);
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}

      {visible && typeof document !== "undefined" &&
        createPortal(
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            data-fb-label="Carte profil survol · Communauté"
            style={{
              // Portalisée dans <body> + position fixed : sort de .nc-page-halo
              // (isolation: isolate) qui piégeait le z-index → la carte passait
              // SOUS le post suivant. En fixed hors halo, elle domine le feed.
              position: "fixed",
              left: coords.left,
              top: coords.top,
              bottom: coords.bottom,
              zIndex: 3000,
              width: CARD_W,
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 16,
              boxShadow: "var(--nc-shadow-2)",
              padding: 16,
              animation: "nc-mode-in var(--nc-duration-fast) var(--nc-ease) both",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <UserAvatar user={user} size={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                    marginTop: 2,
                  }}
                >
                  {joinedAgo(user.joinedAt)}
                </div>
              </div>
            </div>

            {canDM && (
              <>
                <div style={{ height: 1, background: "var(--color-border-default)", margin: "12px 0" }} />
                <button
                  type="button"
                  onClick={handleDM}
                  data-fb-label="Bouton Envoyer un message · Carte profil survol"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "9px 16px",
                    background: "var(--color-surface-raised)",
                    color: "var(--color-text-primary)",
                    border: "none",
                    borderRadius: 9999,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity 150ms ease",
                  }}
                  className="hover:opacity-85"
                >
                  <MessageCircle size={14} />
                  Envoyer un message
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

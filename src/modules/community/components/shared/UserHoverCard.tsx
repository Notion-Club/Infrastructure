"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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

export function UserHoverCard({ user, devRole, children }: UserHoverCardProps) {
  const router = useRouter();
  const viewer = useCurrentUser(devRole);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ above: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCoords({ above: rect.bottom > window.innerHeight - 200 });
      }
      setVisible(true);
    }, 300);
  }, []);

  const hide = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), 200);
  }, []);

  useEffect(() => () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  const canDM = canDMUser(viewer, user);

  function handleDM(e: React.MouseEvent) {
    e.stopPropagation();
    router.push(`/communaute?tab=messages&conversation=${user.id}`);
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}

      {visible && (
        <div
          ref={cardRef}
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{
            position: "absolute",
            [coords.above ? "bottom" : "top"]: "calc(100% + 6px)",
            left: 0,
            zIndex: 200,
            background: "white",
            border: "1px solid var(--color-border-default)",
            borderRadius: 16,
            boxShadow: "var(--nc-shadow-2)",
            padding: 16,
            width: 240,
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
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "9px 16px",
                  background: "var(--color-text-primary)",
                  color: "#fff",
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
        </div>
      )}
    </div>
  );
}

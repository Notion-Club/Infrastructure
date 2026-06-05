"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { MOCK_NOTIFICATIONS } from "../../mocks/notifications.mock";
import type { Notification } from "../../types/notification.types";
import { timeAgo } from "../../utils/date-helpers";
import { UserAvatar } from "../shared/UserAvatar";

const NOTIF_LABELS: Record<Notification["type"], string> = {
  mention_post: "t'a mentionné dans",
  mention_comment: "t'a mentionné dans",
  comment_on_post: "a commenté ton post",
  reply_to_comment: "a répondu à ton commentaire",
  reaction_on_post: "a réagi à ton post",
  new_dm: "t'a envoyé un message",
  admin_annonce: "a publié une annonce",
};

interface NotificationPopoverProps {
  buttonClassName?: string;
}

export function NotificationPopover({ buttonClassName }: NotificationPopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function handleNotifClick(n: Notification) {
    setNotifs((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    if (n.conversationId) {
      router.push(`/communaute?tab=messages&conversation=${n.conversationId}`);
    } else if (n.postId) {
      router.push(`/communaute/post/${n.postId}`);
    }
    setOpen(false);
  }

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        data-fb-label="Bouton Notifications · Communauté"
        className={buttonClassName}
        style={{
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
        }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span
            style={{
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
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-fb-label="Popover notifications · Communauté"
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
            animation: "nc-mode-in var(--nc-duration-fast) var(--nc-ease) both",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px 10px",
              borderBottom: "1px solid var(--color-border-default)",
              position: "sticky",
              top: 0,
              background: "var(--color-surface-card)",
              zIndex: 1,
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

          {/* List */}
          <div>
            {notifs.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotifClick(n)}
                data-fb-label="Carte notification · Popover notifications"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "12px 16px",
                  background: n.read ? "transparent" : "#fef9f8",
                  border: "none",
                  borderBottom: "1px solid var(--color-border-default)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 150ms ease",
                }}
                className="hover:bg-[rgba(0,0,0,0.03)]"
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {n.actorAvatar ? (
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
                        background: "#e0625a",
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
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

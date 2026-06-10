"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useDropdownTransition } from "@/shared/lib/hooks/useDropdownTransition";

type Notification = {
  id: number;
  type: string;
  read: boolean;
  user: string;
  content: string;
  time: string;
  avatar: string;
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: "mention",
    read: false,
    user: "Noah",
    content: "t'a mentionné dans #général",
    time: "Il y a 5 min",
    avatar: "N",
  },
  {
    id: 2,
    type: "coaching",
    read: false,
    user: "Théo",
    content: "a confirmé ton call du jeudi 22 mai à 14h",
    time: "Il y a 1h",
    avatar: "T",
  },
  {
    id: 3,
    type: "formation",
    read: true,
    user: "Système",
    content: "Nouveau module disponible : Formules avancées",
    time: "Hier",
    avatar: "NC",
  },
];

export function NotificationPopover() {
  const { isOpen, isMounted, stateClass, close, toggle } = useDropdownTransition();
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => toggle()}
        data-fb-label="Bouton Notifications · Barre de navigation"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid var(--color-border-default)",
          background: "var(--color-surface-card)",
          cursor: "pointer",
          color: "var(--color-text-secondary)",
          flexShrink: 0,
          transition: "background 150ms ease",
        }}
        className="hover:bg-[var(--color-surface-raised)]"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} notifications non lues`}
            style={{
              position: "absolute",
              top: -3,
              right: -3,
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
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isMounted && (
        <div
          role="dialog"
          aria-label="Notifications"
          data-fb-label="Menu Notifications · Barre de navigation"
          className={`t-dropdown ${stateClass}`}
          data-origin="top-left"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            width: 320,
            borderRadius: 16,
            boxShadow:
              "rgba(0,0,0,0.03) 0px -2px 16px -4px, rgba(0,0,0,0.08) 0px 16px 40px -8px, rgba(0,0,0,0.04) 0px 1px 3px 0px",
            border: "1px solid var(--color-border-default)",
            background: "var(--color-surface-card)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {/* Popover header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px 12px",
              borderBottom: "1px solid var(--color-border-default)",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 14,
                color: "var(--color-text-primary)",
              }}
            >
              Notifications
            </span>
            <button
              type="button"
              onClick={markAllRead}
              data-fb-label="Bouton « Tout marquer lu » · Menu Notifications"
              style={{
                fontSize: 13,
                color: "var(--color-brand)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                padding: 0,
              }}
            >
              Tout marquer lu
            </button>
          </div>

          {/* Notification list */}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {notifications.map((notif, idx) => (
              <li
                key={notif.id}
                data-fb-label={`Carte notification « ${notif.user} » · Menu Notifications`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 16px 12px 22px",
                  background: notif.read ? "white" : "rgba(224,98,90,0.04)",
                  borderBottom:
                    idx < notifications.length - 1
                      ? "1px solid var(--color-border-default)"
                      : "none",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 150ms ease",
                }}
                className="hover:bg-[rgba(0,0,0,0.02)]"
              >
                {!notif.read && (
                  <div
                    style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--color-brand)",
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* Avatar */}
                <div
                  style={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: notif.read ? "var(--color-surface-raised)" : "rgba(224,98,90,0.12)",
                    color: notif.read ? "var(--color-text-secondary)" : "var(--color-brand)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {notif.avatar}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--color-text-primary)",
                      lineHeight: 1.45,
                      margin: 0,
                    }}
                  >
                    <strong>{notif.user}</strong> {notif.content}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-muted)",
                      margin: "3px 0 0",
                    }}
                  >
                    {notif.time}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

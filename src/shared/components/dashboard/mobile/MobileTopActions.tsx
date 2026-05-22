"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import { ThemeToggle } from "@/shared/components/theme/ThemeToggle";
import {
  computeIdentityInitials,
  useProfileIdentityContext,
} from "@/shared/components/identity/ProfileIdentityProvider";

const UNREAD_COUNT = 2;

const CIRCLE: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "0.5px solid rgba(229,231,235,0.9)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  position: "relative",
};

export function MobileTopActions() {
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const { identity } = useProfileIdentityContext();
  const initials = computeIdentityInitials(identity);
  const avatarUrl = identity?.avatarUrl ?? null;
  const avatarColor = identity?.avatarColor ?? "#e0625a";

  useEffect(() => {
    if (!avatarOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [avatarOpen]);

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 8,
        // Force GPU layer so position:fixed isn't broken by ancestor filters.
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      {/* Notifications */}
      <button
        type="button"
        aria-label={`${UNREAD_COUNT} notifications`}
        style={{ ...CIRCLE, color: "var(--color-text-secondary)", border: "0.5px solid rgba(229,231,235,0.9)" }}
      >
        <Bell size={16} />
        {UNREAD_COUNT > 0 && (
          <span
            style={{
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
            }}
          >
            {UNREAD_COUNT}
          </span>
        )}
      </button>

      {/* Avatar + dropdown */}
      <div ref={avatarRef} style={{ position: "relative" }}>
        <button
          type="button"
          aria-label="Menu compte"
          onClick={() => setAvatarOpen((o) => !o)}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: avatarUrl ? "transparent" : avatarColor,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.02em",
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            overflow: "hidden",
            padding: 0,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            initials
          )}
        </button>

        {avatarOpen && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              minWidth: 220,
              borderRadius: 16,
              boxShadow:
                "rgba(0,0,0,0.03) 0px -2px 16px -4px, rgba(0,0,0,0.08) 0px 16px 40px -8px, rgba(0,0,0,0.04) 0px 1px 3px 0px",
              background: "white",
              border: "1px solid var(--color-border-default)",
              overflow: "hidden",
              zIndex: 60,
              padding: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 10px",
              }}
            >
              <span style={{ fontSize: 14, color: "var(--color-text-primary)" }}>
                Mode sombre
              </span>
              <ThemeToggle />
            </div>
            <div
              style={{
                height: 1,
                background: "var(--color-border-default)",
                margin: "4px 0",
              }}
            />
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setAvatarOpen(false)}
              style={{
                display: "block",
                padding: "10px 10px",
                fontSize: 14,
                color: "var(--color-text-primary)",
                textDecoration: "none",
                borderRadius: 10,
                transition: "background 150ms ease",
              }}
              className="hover:bg-[var(--color-surface-raised)]"
            >
              Réglages
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { LayoutDashboard, BookOpen, Users, Calendar, type LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Formation", icon: BookOpen, href: "/formation" },
  { label: "Communauté", icon: Users, href: "/communaute" },
  { label: "Coaching", icon: Calendar, href: "/coaching" },
];

const ACTIVE_HREF = "/dashboard";

export function BottomNav() {
  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: "fixed",
        bottom: 10,
        left: 12,
        right: 12,
        height: 56,
        zIndex: 50,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "0.5px solid rgba(229,231,235,0.9)",
        borderRadius: 9999,
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        display: "flex",
        alignItems: "center",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
        const isActive = href === ACTIVE_HREF;
        return (
          <a
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              padding: isActive ? "6px 16px" : "6px 0",
              borderRadius: 9999,
              background: isActive ? "rgba(224,98,90,0.08)" : "transparent",
              transition: "background 150ms ease",
              textDecoration: "none",
            }}
          >
            <Icon
              size={20}
              strokeWidth={isActive ? 2.5 : 2}
              style={{ color: isActive ? "var(--color-brand)" : "var(--color-text-muted)" }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.01em",
                color: isActive ? "var(--color-brand)" : "var(--color-text-muted)",
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

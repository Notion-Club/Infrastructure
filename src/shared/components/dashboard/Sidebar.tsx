import Link from "next/link";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Calendar,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { NotificationPopover } from "./NotificationPopover";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
  active?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: LayoutDashboard, href: "/dashboard", active: true },
  { label: "Formation", icon: BookOpen, href: "/formation" },
  { label: "Communauté", icon: Users, href: "/communaute" },
  { label: "Coaching", icon: Calendar, href: "/coaching" },
];

export function Sidebar() {
  return (
    <aside
      className="hidden md:flex flex-col"
      style={{
        width: 220,
        flexShrink: 0,
        height: "100dvh",
        position: "sticky",
        top: 0,
        background: "white",
        borderRight: "1px solid var(--color-border-default)",
        zIndex: 10,
      }}
    >
      {/* Header : brand pill + notifications */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 14px 13px",
          borderBottom: "1px solid var(--color-border-default)",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "6px 10px",
            background: "#000000",
            color: "#ffffff",
            borderRadius: 9999,
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Notion Club
          </span>
          {/* Blinking accent dot */}
          <span
            className="nc-blink-dot"
            style={{ width: 7, height: 7, flexShrink: 0 }}
          />
        </div>

        <NotificationPopover />
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          padding: "10px 10px 0",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflowY: "auto",
        }}
      >
        {NAV_ITEMS.map(({ label, icon: Icon, href, active }) => (
          <Link
            key={href}
            href={href}
            style={
              active
                ? {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    background: "white",
                    border: "1px solid var(--color-border-default)",
                    boxShadow: "var(--nc-shadow-3)",
                    textDecoration: "none",
                  }
                : {
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    fontSize: 14,
                    color: "var(--color-text-secondary)",
                    textDecoration: "none",
                    transition: "background 150ms ease, color 150ms ease",
                  }
            }
            className={
              !active
                ? "hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--color-text-primary)]"
                : undefined
            }
          >
            <Icon size={16} strokeWidth={active ? 2.5 : 2} style={{ flexShrink: 0 }} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Réglages */}
      <div style={{ borderTop: "1px solid var(--color-border-default)", padding: 10 }}>
        <Link
          href="/reglages"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 10,
            fontSize: 14,
            color: "var(--color-text-secondary)",
            textDecoration: "none",
            transition: "background 150ms ease, color 150ms ease",
          }}
          className="hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--color-text-primary)]"
        >
          <Settings size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
          Réglages
        </Link>
      </div>
    </aside>
  );
}

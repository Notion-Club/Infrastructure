"use client";

import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, Calendar, Library, type LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: Home, href: "/dashboard" },
  { label: "Formation", icon: BookOpen, href: "/formation" },
  { label: "Communauté", icon: Users, href: "/communaute" },
  { label: "Coaching", icon: Calendar, href: "/coaching" },
  { label: "Ressources", icon: Library, href: "/ressources" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: "fixed",
        // En PWA standalone, `env(safe-area-inset-bottom)` vaut ~34px sur
        // iPhone (home indicator). On le combine au bottom de base pour
        // remonter la pill au-dessus de la zone système ; appliquer un
        // padding-bottom dilaterait la pill sans déplacer les icônes (la
        // height fixe ne contient pas le padding) — visuellement, on
        // verrait l'encadré décalé sous les boutons.
        bottom: "calc(10px + env(safe-area-inset-bottom))",
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
        padding: "0 6px",
      }}
    >
      {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <a
            key={href}
            href={href}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
              height: 44,
              margin: "0 1px",
              borderRadius: 9999,
              background: isActive ? "rgba(0,0,0,0.07)" : "transparent",
              transition: "background 150ms ease",
              textDecoration: "none",
            }}
          >
            <Icon
              size={19}
              strokeWidth={isActive ? 2.5 : 2}
              style={{ color: "#000", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.01em",
                color: "#000",
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

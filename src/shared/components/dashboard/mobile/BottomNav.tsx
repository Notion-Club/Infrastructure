"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, Calendar, Library, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

type NavItem = { label: string; icon: LucideIcon; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: Home, href: "/dashboard" },
  { label: "Formation", icon: BookOpen, href: "/formation" },
  { label: "Communauté", icon: Users, href: "/communaute" },
  { label: "Coaching", icon: Calendar, href: "/coaching" },
  { label: "Ressources", icon: Library, href: "/ressources" },
];

// Spring config partagé avec Topbar — garder les deux valeurs synchronisées.
const SPRING = { type: "spring" as const, stiffness: 420, damping: 30, mass: 0.85 };

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      style={{
        position: "fixed",
        bottom: "calc(10px + env(safe-area-inset-bottom))",
        left: 12,
        right: 12,
        height: 56,
        zIndex: 50,
        background: "var(--nc-bottom-nav-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "0.5px solid var(--nc-bottom-nav-border)",
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
          <Link
            key={href}
            href={href}
            style={{
              // position: relative crée un contexte d'empilement pour le pill absolu.
              position: "relative",
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
              background: "transparent",
              textDecoration: "none",
            }}
          >
            {/*
             * layoutId="bottom-nav-pill" : Framer Motion traque cet élément
             * entre les différents items actifs via FLIP. Quand l'item actif
             * change, le pill "voyage" de sa position précédente à la nouvelle
             * sans getBoundingClientRect ni useLayoutEffect.
             * Le spring se déclenche immédiatement, indépendamment du cycle
             * de rendu React — c'est pourquoi ça fonctionne sur mobile.
             */}
            {isActive && (
              <motion.div
                layoutId="bottom-nav-pill"
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "var(--nc-nav-active-bg)",
                  borderRadius: 9999,
                  // z-index négatif : le pill passe DERRIÈRE l'icône et le label
                  // sans bloquer les clics (pointerEvents hérité du Link).
                  zIndex: -1,
                }}
                transition={SPRING}
              />
            )}
            <Icon
              size={19}
              strokeWidth={isActive ? 2.5 : 2}
              style={{ color: "var(--color-text-primary)", flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: isActive ? 600 : 500,
                letterSpacing: "0.01em",
                color: "var(--color-text-primary)",
                lineHeight: 1,
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

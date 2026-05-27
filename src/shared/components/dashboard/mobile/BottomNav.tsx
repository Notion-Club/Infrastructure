"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, Calendar, Library, type LucideIcon } from "lucide-react";
import { motion, useSpring } from "framer-motion";

type NavItem = { label: string; icon: LucideIcon; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: Home, href: "/dashboard" },
  { label: "Formation", icon: BookOpen, href: "/formation" },
  { label: "Communauté", icon: Users, href: "/communaute" },
  { label: "Coaching", icon: Calendar, href: "/coaching" },
  { label: "Ressources", icon: Library, href: "/ressources" },
];

// Spring config : léger overshoot organique, ~300 ms de règlement.
// Pour plus de bounce : damping 22, mass 0.7.
// Pour ultra-smooth sans rebond : stiffness 300, damping 38.
const SPRING_CFG = { stiffness: 420, damping: 30, mass: 0.85 };

export function BottomNav() {
  const pathname = usePathname();

  // Refs pour la mesure (position/taille du Link actif).
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const hasInit = useRef(false);

  // Springs impératifs — indépendants du cycle de rendu React.
  // .set(v)  → anime en spring vers v.
  // .jump(v) → positionne instantanément sans animation (premier rendu).
  const springX = useSpring(0, SPRING_CFG);
  const springW = useSpring(0, SPRING_CFG);

  // Géométrie non-animée (hauteur, top) — constante entre les items.
  const [pillGeom, setPillGeom] = useState<{ h: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const activeIndex = NAV_ITEMS.findIndex(
      ({ href }) => pathname === href || pathname.startsWith(href + "/"),
    );
    const navEl = navRef.current;
    const el = itemRefs.current[activeIndex];
    if (!navEl || !el) return;

    const nr = navEl.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const x = er.left - nr.left;
    const w = er.width;

    if (!hasInit.current) {
      // Premier rendu : saut instantané (pas d'animation depuis 0).
      springX.jump(x);
      springW.jump(w);
      hasInit.current = true;
      setPillGeom({ h: er.height, top: er.top - nr.top });
    } else {
      // Navigations suivantes : spring.
      springX.set(x);
      springW.set(w);
    }
  }, [pathname, springX, springW]);

  return (
    <nav
      ref={navRef}
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
      {/* Pill glissante — sibling externe, positionnée dans le nav container.
          Utilise des motion values (spring) plutôt qu'une CSS transition
          pour un glissement organique avec micro-rebond. */}
      {pillGeom && (
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            top: pillGeom.top,
            height: pillGeom.h,
            x: springX,
            width: springW,
            background: "var(--nc-nav-active-bg)",
            borderRadius: 9999,
            pointerEvents: "none",
          }}
        />
      )}

      {NAV_ITEMS.map(({ label, icon: Icon, href }, i) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            ref={(el) => { itemRefs.current[i] = el; }}
            style={{
              position: "relative",
              zIndex: 1,
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

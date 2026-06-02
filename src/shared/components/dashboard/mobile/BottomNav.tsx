"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, Calendar, Library, type LucideIcon } from "lucide-react";

type NavItem = { label: string; icon: LucideIcon; href: string };

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", icon: Home, href: "/dashboard" },
  { label: "Formation", icon: BookOpen, href: "/formation" },
  { label: "Communauté", icon: Users, href: "/communaute" },
  { label: "Coaching", icon: Calendar, href: "/coaching" },
  { label: "Ressources", icon: Library, href: "/ressources" },
];

// Même courbe que le snippet Transitions.dev — décélération naturelle sans rebond.
const PILL_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const PILL_DUR  = "220ms";
const PILL_TRANSITION = `transform ${PILL_DUR} ${PILL_EASE}, width ${PILL_DUR} ${PILL_EASE}`;

export function BottomNav() {
  const pathname = usePathname();

  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const pillRef  = useRef<HTMLDivElement>(null);
  const hasInit  = useRef(false);

  useLayoutEffect(() => {
    const activeIndex = NAV_ITEMS.findIndex(
      ({ href }) => pathname === href || pathname.startsWith(href + "/"),
    );
    const el   = itemRefs.current[activeIndex];
    const pill = pillRef.current;
    if (!el || !pill) return;

    const x = el.offsetLeft;
    const w = el.offsetWidth;

    if (!hasInit.current) {
      // Premier rendu : snap instantané avant toute paint.
      // On pose top/height une seule fois (identiques pour tous les items).
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${x}px)`;
      pill.style.width     = `${w}px`;
      void pill.offsetWidth; // force reflow — évite que le navigateur batchise
      pill.style.transition = PILL_TRANSITION;
      hasInit.current = true;
    } else {
      // Navigations suivantes : le CSS transition prend le relais.
      pill.style.transform = `translateX(${x}px)`;
      pill.style.width     = `${w}px`;
    }
  }, [pathname]);

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
      {/* Pill glissante — div abs positionnée par offsetLeft/offsetWidth via JS.
          Commence à width:0 invisible, positionnée sur le premier rendu sans transition,
          puis glisse via CSS transition sur les changements de page suivants. */}
      <div
        ref={pillRef}
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: 0,
          width: 0,
          background: "var(--nc-nav-active-bg)",
          borderRadius: 9999,
          pointerEvents: "none",
          willChange: "transform, width",
        }}
      />

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

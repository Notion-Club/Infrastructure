"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
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

export function BottomNav() {
  const pathname = usePathname();

  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const pillRef  = useRef<HTMLDivElement>(null);

  // Identique au moveTo() du snippet Transitions.dev.
  // animate=false → snap sans transition (premier rendu, resize, retour nav).
  // animate=true  → glissement CSS (déclenché directement au clic).
  const moveTo = useCallback((idx: number, animate: boolean) => {
    const el   = itemRefs.current[idx];
    const pill = pillRef.current;
    if (!el || !pill) return;

    if (!animate) {
      // Sauvegarde la transition CSS courante (vide = class CSS actif),
      // suspend, snap, force reflow, puis restaure → la class reprend.
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
      void pill.offsetWidth; // force reflow
      pill.style.transition = prev;
    } else {
      // La transition est portée par la class CSS nc-nav-pill.
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
    }
  }, []);

  // Snap au bon item sans animation : premier rendu + retour/avance navigateur.
  useLayoutEffect(() => {
    const idx = NAV_ITEMS.findIndex(
      ({ href }) => pathname === href || pathname.startsWith(href + "/"),
    );
    moveTo(idx, false);
  }, [pathname, moveTo]);

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
      {/* Pill glissante — class nc-nav-pill porte la CSS transition.
          JS gère uniquement transform, width, top, height via moveTo(). */}
      <div
        ref={pillRef}
        aria-hidden
        className="nc-nav-pill"
        style={{
          position: "absolute",
          left: 0,
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
            onClick={() => moveTo(i, true)}
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

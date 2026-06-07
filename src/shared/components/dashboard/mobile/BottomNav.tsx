"use client";

import { useLayoutEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();

  const itemRefs       = useRef<(HTMLAnchorElement | null)[]>([]);
  const pillRef        = useRef<HTMLDivElement>(null);
  const lastClickedRef = useRef<number>(-1);

  // Pattern du snippet Transitions.dev — animate=false : snap (reflow trick),
  // animate=true : glissement via la CSS transition de .nc-nav-pill.
  const moveTo = useCallback((idx: number, animate: boolean) => {
    const el   = itemRefs.current[idx];
    const pill = pillRef.current;
    if (!el || !pill) return;

    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
      void pill.offsetWidth; // force reflow — commit sans animation
      pill.style.transition = prev;
    } else {
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
    }
  }, []);

  // Snap sans animation : premier rendu + retour/avance navigateur.
  // Si l'utilisateur vient de cliquer sur cet item, l'animation CSS est déjà
  // en cours — on ne snappe pas pour ne pas l'interrompre.
  useLayoutEffect(() => {
    const idx = NAV_ITEMS.findIndex(
      ({ href }) => pathname === href || pathname.startsWith(href + "/"),
    );
    if (lastClickedRef.current === idx) {
      lastClickedRef.current = -1;
      return;
    }
    lastClickedRef.current = -1;
    moveTo(idx, false);
  }, [pathname, moveTo]);

  return (
    <nav
      aria-label="Navigation principale"
      data-fb-label="Barre de navigation"
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
          top/height/transform/width écrits via moveTo(), jamais via React state. */}
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
        const isActive     = pathname === href || pathname.startsWith(href + "/");
        const isCommunaute = href === "/communaute";
        return (
          <Link
            key={href}
            href={href}
            ref={(el) => { itemRefs.current[i] = el; }}
            data-fb-label={`Onglet « ${label} » · Barre de navigation`}
            onClick={(e) => {
              // Animation immédiate au clic — avant que Next.js charge la page.
              lastClickedRef.current = i;
              moveTo(i, true);
              // Comportement Communauté : scroll vers le haut si déjà sur la page.
              if (isCommunaute && pathname.startsWith("/communaute")) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
                router.push("/communaute");
              }
            }}
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

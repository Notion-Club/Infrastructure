"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Users, Calendar, Library, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

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

  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState<{ x: number; width: number; height: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const activeIndex = NAV_ITEMS.findIndex(
      ({ href }) => pathname === href || pathname.startsWith(href + "/"),
    );
    const navEl = navRef.current;
    const activeEl = itemRefs.current[activeIndex];
    if (!navEl || !activeEl) return;
    const navRect = navEl.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    setPill({
      x: activeRect.left - navRect.left,
      width: activeRect.width,
      height: activeRect.height,
      top: activeRect.top - navRect.top,
    });
  }, [pathname]);

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
      {/* Pilule glissante — spring Framer Motion */}
      {pill && (
        <motion.div
          aria-hidden
          initial={false}
          animate={{ x: pill.x, width: pill.width, height: pill.height, y: pill.top }}
          transition={NAV_SPRING}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
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

const NAV_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 30,
  mass: 0.85,
};

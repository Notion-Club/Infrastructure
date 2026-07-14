"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================================
// ViewportProbe — sonde de mesure TEMPORAIRE (chantier nav/clavier PWA).
//
// But : afficher EN DIRECT, dans la PWA, les métriques réelles du viewport iOS
// pour comprendre pourquoi la BottomNav reste bloquée en haut après fermeture du
// clavier. On NE devine plus : on lit la vérité terrain (cf. README §6).
//
// Poll à 200ms (ET events) : dans l'état « figé » iOS n'émet PLUS d'événement
// visualViewport → sans polling, le panneau afficherait des valeurs périmées.
//
// À RETIRER une fois le bug compris/corrigé. Gate FORCE_DEBUG.
// ============================================================================

const FORCE_DEBUG = true;

type Metrics = Record<string, number | string>;

export function ViewportProbe() {
  const [m, setM] = useState<Metrics>({});
  // Probes CSS (hauteurs résolues) — mesurées via getBoundingClientRect.
  const dvhRef = useRef<HTMLDivElement>(null);
  const lvhRef = useRef<HTMLDivElement>(null);
  const svhRef = useRef<HTMLDivElement>(null);
  const safeBRef = useRef<HTMLDivElement>(null);
  const safeTRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!FORCE_DEBUG) return;
    const read = (): Metrics => {
      const vv = window.visualViewport;
      const nav = document.querySelector<HTMLElement>(".nc-bottom-nav");
      const navRect = nav?.getBoundingClientRect();
      const px = (el: HTMLElement | null) =>
        el ? Math.round(el.getBoundingClientRect().height) : -1;
      const innerH = window.innerHeight;
      const navBottom = navRect ? Math.round(navRect.bottom) : -1;
      const navTop = navRect ? Math.round(navRect.top) : -1;
      const vvh = vv ? Math.round(vv.height) : -1;
      const vvot = vv ? Math.round(vv.offsetTop) : -1;
      return {
        innerH,
        innerW: window.innerWidth,
        "vv.h": vvh,
        "vv.oT": vvot,
        "vv.pT": vv ? Math.round(vv.pageTop) : -1,
        "vv.scale": vv ? +vv.scale.toFixed(2) : -1,
        clientH: document.documentElement.clientHeight,
        dvh: px(dvhRef.current),
        lvh: px(lvhRef.current),
        svh: px(svhRef.current),
        safeB: px(safeBRef.current),
        safeT: px(safeTRef.current),
        navTop,
        navBot: navBottom,
        // Écart entre le bas de la nav et le bas du innerHeight / de la zone visible.
        // > 0 ⇒ la nav flotte au-dessus du bas → c'est LE symptôme à expliquer.
        "gap↓innerH": navBottom >= 0 ? innerH - navBottom : -1,
        "gap↓vv": navBottom >= 0 && vv ? vvot + vvh - navBottom : -1,
        kbOpen: document.body.classList.contains("nc-kb-open") ? "YES" : "no",
        "--nc-vvh":
          getComputedStyle(document.documentElement)
            .getPropertyValue("--nc-vvh")
            .trim() || "(none)",
        scrollY: Math.round(window.scrollY),
      };
    };
    const tick = () => setM(read());
    tick();
    const id = window.setInterval(tick, 200);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", tick);
    vv?.addEventListener("scroll", tick);
    return () => {
      window.clearInterval(id);
      vv?.removeEventListener("resize", tick);
      vv?.removeEventListener("scroll", tick);
    };
  }, []);

  if (!FORCE_DEBUG) return null;

  const rows = Object.entries(m);

  return (
    <>
      {/* Probes CSS résolues (invisibles, 0 largeur). */}
      <div ref={dvhRef} style={{ position: "fixed", height: "100dvh", width: 0, top: 0, left: 0, visibility: "hidden", pointerEvents: "none" }} aria-hidden />
      <div ref={lvhRef} style={{ position: "fixed", height: "100lvh", width: 0, top: 0, left: 0, visibility: "hidden", pointerEvents: "none" }} aria-hidden />
      <div ref={svhRef} style={{ position: "fixed", height: "100svh", width: 0, top: 0, left: 0, visibility: "hidden", pointerEvents: "none" }} aria-hidden />
      <div ref={safeBRef} style={{ position: "fixed", height: "env(safe-area-inset-bottom)", width: 0, top: 0, left: 0, visibility: "hidden", pointerEvents: "none" }} aria-hidden />
      <div ref={safeTRef} style={{ position: "fixed", height: "env(safe-area-inset-top)", width: 0, top: 0, left: 0, visibility: "hidden", pointerEvents: "none" }} aria-hidden />

      {/* Panneau lisible. `pointer-events: none` → il NE bloque JAMAIS les taps
          (switcher, champ…), tout passe au travers. Ancré SOUS les onglets (au-
          dessus de la liste), visible dans les 3 états. Dans l'état figé iOS les
          valeurs sont statiques → l'affichage live suffit pour screenshot. */}
      <div
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 116px)",
          left: 4,
          right: 4,
          zIndex: 2147483647,
          background: "rgba(0,0,0,0.72)",
          color: "#0f0",
          font: "600 11px/1.35 ui-monospace, monospace",
          padding: "6px 8px",
          borderRadius: 8,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1px 10px",
          pointerEvents: "none",
        }}
        aria-hidden
      >
        {rows.map(([k, v]) => (
          <div key={k} style={{ whiteSpace: "nowrap" }}>
            <span style={{ color: "#7ad" }}>{k}</span>{" "}
            <span style={{ color: v === "YES" ? "#fd0" : "#0f0" }}>{String(v)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

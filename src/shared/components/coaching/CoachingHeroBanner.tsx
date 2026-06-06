"use client";

// Slot 1 — Bannière HERO, pièce maîtresse de l'espace coaching.
//
// Encadré 2 colonnes :
//   • Gauche : titre (gros) + description + (optionnel) pill « prochain appel »
//   • Droite : accroche (petit texte) + bouton CTA adaptatif
//
// Sur mobile : empilé (gauche au-dessus, bouton pleine largeur dessous).
//
// DA SaaS B2B 2026 : fond brand-tinté subtil, entrée `nc-mode-in`, hover =
// élévation + glow brand. Le bouton réutilise `nc-btn-shine` (shimmer) tant
// qu'il est actif. Tout passe par les tokens du design system.

import { useState } from "react";
import { NextCallPill, type NextCallPillData } from "./NextCallPill";

export interface HeroButtonConfig {
  label: string;
  disabled?: boolean;
  disabledTooltip?: string;
  onClick?: () => void;
}

interface CoachingHeroBannerProps {
  title: string;
  description: string;
  accroche: string;
  button: HeroButtonConfig;
  // Pill « prochain appel » (états accompagnement uniquement). Source live
  // Notion — masquée si null.
  nextCall?: NextCallPillData;
}

export function CoachingHeroBanner({
  title,
  description,
  accroche,
  button,
  nextCall,
}: CoachingHeroBannerProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const disabled = !!button.disabled;

  return (
    <div
      data-fb-label="Bannière hero · Coaching"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "28px 24px",
        borderRadius: 20,
        // Verre dépoli : halo brand + surface translucide + flou d'arrière-plan.
        background:
          "radial-gradient(130% 150% at 0% 0%, rgba(224,98,90,0.13), transparent 58%), var(--nc-glass-bg)",
        backdropFilter: "blur(16px) saturate(1.3)",
        WebkitBackdropFilter: "blur(16px) saturate(1.3)",
        border: "1px solid var(--nc-glass-border)",
        // Reflet interne (glass) + halo de lumière brand aux coins au hover.
        // Pas de surélévation.
        boxShadow: hovered
          ? "var(--nc-glass-highlight), 0 0 0 1px rgba(224,98,90,0.18), 0 12px 40px rgba(224,98,90,0.16)"
          : "var(--nc-glass-highlight), var(--nc-shadow-2)",
        transition: "box-shadow 320ms var(--nc-ease)",
      }}
      className="md:!px-9 md:!py-8"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
        {/* Colonne gauche — titre + description + pill prochain appel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            data-fb-label="Titre · Bannière hero"
            style={{
              fontSize: "clamp(26px, 3.4vw, 38px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "var(--color-text-primary)",
              margin: 0,
              lineHeight: 1.12,
            }}
          >
            {title}
          </h1>

          <p
            data-fb-label="Description · Bannière hero"
            style={{
              fontSize: 15,
              color: "var(--color-text-secondary)",
              lineHeight: 1.6,
              margin: "12px 0 0",
              maxWidth: 560,
            }}
          >
            {description}
          </p>

          {nextCall && <NextCallPill data={nextCall} />}
        </div>

        {/* Colonne droite — accroche + bouton CTA */}
        <div
          className="md:items-end md:text-right"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <p
            data-fb-label="Accroche · Bannière hero"
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              margin: 0,
            }}
          >
            {accroche}
          </p>

          <div
            className="w-full md:w-auto"
            style={{ position: "relative" }}
            onMouseEnter={() => disabled && setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            <button
              type="button"
              data-fb-label="Bouton CTA · Bannière hero"
              onClick={disabled ? undefined : button.onClick}
              disabled={disabled}
              className={`w-full md:w-auto ${disabled ? "" : "nc-btn-shine"}`}
              style={{
                padding: "13px 26px",
                borderRadius: 9999,
                background: disabled
                  ? "var(--nc-btn-disabled-bg)"
                  : "var(--color-brand)",
                color: disabled ? "var(--nc-btn-disabled-text)" : "#fff",
                fontSize: 15,
                fontWeight: 600,
                border: "none",
                cursor: disabled ? "default" : "pointer",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
                transition: "background 150ms ease, opacity 150ms ease",
              }}
            >
              {button.label}
            </button>

            {/* Tooltip état grisé (quota / indisponible) */}
            {disabled && button.disabledTooltip && tooltipVisible && (
              <div
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 10px)",
                  right: 0,
                  background: "var(--nc-btn-dark-bg)",
                  color: "var(--nc-btn-dark-text)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  padding: "8px 12px",
                  borderRadius: 8,
                  whiteSpace: "pre-line",
                  maxWidth: 320,
                  textAlign: "center",
                  zIndex: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  pointerEvents: "none",
                }}
              >
                {button.disabledTooltip}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

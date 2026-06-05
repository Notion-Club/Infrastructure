"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";

interface CoachingCTACardProps {
  icon: LucideIcon;
  iconOpacity?: number;
  secondaryText: string;
  buttonText: string;
  disabled?: boolean;
  disabledTooltip?: string;
  onButtonClick?: () => void;
}

export function CoachingCTACard({
  icon: Icon,
  iconOpacity = 1,
  secondaryText,
  buttonText,
  disabled = false,
  disabledTooltip,
  onButtonClick,
}: CoachingCTACardProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-fb-label="Carte CTA coaching · CTA coaching"
      className="nc-shine-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transition: "box-shadow 280ms cubic-bezier(0.22,1,0.36,1)",
        boxShadow: hovered
          ? "0 0 0 3px rgba(224,98,90,0.18), 0 8px 32px rgba(224,98,90,0.14)"
          : undefined,
      }}
    >
      <div className="nc-shine-card__inner" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Icon circle */}
          <div
            data-fb-label="Icône · CTA coaching"
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              background: "rgba(224, 98, 90, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "transform 280ms cubic-bezier(0.22,1,0.36,1)",
              transform: hovered ? "scale(1.08)" : "scale(1)",
            }}
          >
            <Icon
              size={26}
              style={{
                color: "var(--color-brand)",
                opacity: iconOpacity,
              }}
            />
          </div>

          {/* Secondary text */}
          <p
            data-fb-label="Sous-titre · CTA coaching"
            style={{
              flex: 1,
              fontSize: 14,
              color: "var(--color-text-muted)",
              margin: 0,
              minWidth: 0,
            }}
          >
            {secondaryText}
          </p>

          {/* Button + optional tooltip */}
          <div
            style={{ position: "relative", flexShrink: 0 }}
            onMouseEnter={() => disabled && setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            <button
              type="button"
              data-fb-label="Bouton CTA · CTA coaching"
              onClick={disabled ? undefined : onButtonClick}
              disabled={disabled}
              className={!disabled ? "nc-btn-shine" : undefined}
              style={{
                padding: "12px 22px",
                borderRadius: 9999,
                background: disabled ? "var(--nc-btn-disabled-bg)" : "var(--color-brand)",
                color: disabled ? "var(--nc-btn-disabled-text)" : "#fff",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: disabled ? "default" : "pointer",
                transition: "background 150ms ease, opacity 150ms ease",
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {buttonText}
            </button>

            {/* Custom tooltip for disabled state */}
            {disabled && disabledTooltip && tooltipVisible && (
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
                  maxWidth: 240,
                  textAlign: "center",
                  zIndex: 10,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                  pointerEvents: "none",
                }}
              >
                {disabledTooltip}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  return (
    <div className="nc-shine-card" style={{ height: "100%" }}>
      <div
        className="nc-shine-card__inner"
        style={{ textAlign: "center", height: "100%", boxSizing: "border-box" }}
      >
        {/* Icon circle */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "rgba(224, 98, 90, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <Icon
            size={38}
            style={{
              color: "var(--color-brand)",
              opacity: iconOpacity,
            }}
          />
        </div>

        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-muted)",
            margin: "0 0 20px",
          }}
        >
          {secondaryText}
        </p>

        {/* Button + optional tooltip */}
        <div
          style={{ position: "relative", display: "inline-block", width: "100%" }}
          onMouseEnter={() => disabled && setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          <button
            type="button"
            onClick={disabled ? undefined : onButtonClick}
            disabled={disabled}
            className={!disabled ? "nc-btn-shine" : undefined}
            style={{
              width: "100%",
              padding: "14px 24px",
              borderRadius: 9999,
              background: disabled ? "#e5e7eb" : "var(--color-brand)",
              color: disabled ? "#9ca3af" : "#fff",
              fontSize: 15,
              fontWeight: 600,
              border: "none",
              cursor: disabled ? "default" : "pointer",
              transition: "background 150ms ease, opacity 150ms ease",
              letterSpacing: "-0.01em",
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
                left: "50%",
                transform: "translateX(-50%)",
                background: "#18181b",
                color: "#fff",
                fontSize: 12,
                lineHeight: 1.5,
                padding: "8px 12px",
                borderRadius: 8,
                whiteSpace: "pre-line",
                maxWidth: 260,
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
  );
}

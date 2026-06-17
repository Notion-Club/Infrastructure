"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Settings, X } from "lucide-react";

import { SCENARIOS, type ScenarioId } from "@/shared/lib/settings/scenarios";

type DevPanelProps = {
  scenarioId: ScenarioId;
  onScenarioChange: (next: ScenarioId) => void;
};

export function DevPanel({ scenarioId, onScenarioChange }: DevPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 80,
        transform: "translateZ(0)",
      }}
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le panneau de simulation"
          data-fb-label="Bouton panneau dev · Réglages"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 9999,
            border: "1px solid #1f1f23",
            background: "#0c0c0d",
            color: "white",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            letterSpacing: "0.02em",
          }}
        >
          <Settings size={13} />
          DEV
          <ChevronRight size={12} style={{ opacity: 0.6 }} />
        </button>
      ) : (
        <div
          role="dialog"
          aria-label="Simulations dev"
          data-fb-label="Panneau dev · Réglages"
          style={{
            width: 320,
            maxWidth: "calc(100vw - 40px)",
            background: "#0c0c0d",
            color: "white",
            borderRadius: 16,
            border: "1px solid #1f1f23",
            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid #1f1f23",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  color: "#e0625a",
                }}
              >
                DEV TOOLS
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.3,
                }}
              >
                Scénarios d&apos;abonnement
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} />
            </button>
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              maxHeight: 360,
              overflowY: "auto",
            }}
          >
            {SCENARIOS.map((scenario) => {
              const active = scenario.id === scenarioId;
              return (
                <li key={scenario.id}>
                  <button
                    type="button"
                    onClick={() => onScenarioChange(scenario.id)}
                    data-fb-label="Bouton scénario · Panneau dev"
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: active
                        ? "1px solid rgba(224,98,90,0.45)"
                        : "1px solid transparent",
                      background: active
                        ? "rgba(224,98,90,0.12)"
                        : "transparent",
                      color: "white",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      transition: "background 150ms ease",
                    }}
                    className="hover:bg-[rgba(255,255,255,0.05)]"
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: active ? "#f08a82" : "white",
                      }}
                    >
                      {scenario.label}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.55)",
                        lineHeight: 1.4,
                      }}
                    >
                      {scenario.description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

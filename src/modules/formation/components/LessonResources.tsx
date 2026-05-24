import { ExternalLink, FileText, LayoutTemplate } from "lucide-react";

import type { LessonResourceLink } from "../server/notion";

// Pills catégorie répliquées du module /ressources (Ressource = bleu,
// Template = violet) — sans import cross-module.
const CATEGORY: Record<
  LessonResourceLink["category"],
  { label: string; bg: string; color: string; dot: string }
> = {
  resource: { label: "Ressource", bg: "rgba(37,99,235,0.10)", color: "#1d4ed8", dot: "#3b82f6" },
  template: { label: "Template", bg: "rgba(124,58,237,0.10)", color: "#6d28d9", dot: "#8b5cf6" },
};

export function LessonResources({ items }: { items: LessonResourceLink[] }) {
  if (items.length === 0) return null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: "var(--color-text-primary)",
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        Ressources liées
      </h2>

      <div
        style={{
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {items.map((item, i) => {
          const cat = CATEGORY[item.category];
          const Icon = item.category === "template" ? LayoutTemplate : FileText;
          return (
            <a
              key={item.notionId}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group hover:bg-[var(--color-surface-raised)]"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 18px",
                textDecoration: "none",
                borderTop: i === 0 ? "none" : "1px solid var(--color-border-default)",
                transition: "background 200ms var(--nc-ease)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "var(--color-surface-raised)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  color: "var(--color-text-secondary)",
                }}
              >
                <Icon size={17} />
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.title}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px 3px 8px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: 1.4,
                      background: cat.bg,
                      color: cat.color,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{ width: 7, height: 7, borderRadius: "50%", background: cat.dot }}
                    />
                    {cat.label}
                  </span>
                  {item.typeLabel && (
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      {item.typeLabel}
                    </span>
                  )}
                </div>
              </div>

              <ExternalLink
                size={16}
                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ color: "var(--color-brand)", flexShrink: 0 }}
              />
            </a>
          );
        })}
      </div>
    </section>
  );
}

import { FileText, BookOpen, Video, Lock } from "lucide-react";
import type { Resource, ResourceType } from "../types";

const TYPE_CONFIG: Record<
  ResourceType,
  { label: string; icon: typeof FileText; color: string; bg: string; border: string }
> = {
  template: {
    label: "Template",
    icon: FileText,
    color: "#2563eb",
    bg: "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.2)",
  },
  guide: {
    label: "Guide",
    icon: BookOpen,
    color: "#16a34a",
    bg: "rgba(22,163,74,0.08)",
    border: "rgba(22,163,74,0.2)",
  },
  redif: {
    label: "Redif",
    icon: Video,
    color: "var(--color-brand)",
    bg: "rgba(224,98,90,0.08)",
    border: "rgba(224,98,90,0.2)",
  },
};

type Props = {
  resource: Resource;
};

export function ResourceCard({ resource }: Props) {
  const { title, description, type, tags, locked } = resource;
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <article
      style={{
        background: "white",
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: 20,
        boxShadow: "var(--nc-shadow-3)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        overflow: "hidden",
        cursor: locked ? "default" : "pointer",
        transition:
          "box-shadow 250ms cubic-bezier(0.22, 1, 0.36, 1), transform 250ms cubic-bezier(0.22, 1, 0.36, 1)",
        opacity: locked ? 0.7 : 1,
      }}
      className={
        locked
          ? undefined
          : "hover:-translate-y-0.5 hover:shadow-[rgba(0,0,0,0.10)_0px_8px_32px_0px,rgba(0,0,0,0.06)_0px_1px_2px_0px]"
      }
    >
      {/* Type badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            background: config.bg,
            border: `1px solid ${config.border}`,
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 600,
            color: config.color,
            letterSpacing: "0.03em",
          }}
        >
          <Icon size={11} strokeWidth={2.5} />
          {config.label}
        </span>

        {locked && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              background: "rgba(100,116,139,0.08)",
              border: "1px solid rgba(100,116,139,0.2)",
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-muted)",
              marginLeft: "auto",
            }}
          >
            <Lock size={10} strokeWidth={2.5} />
            Pro
          </span>
        )}
      </div>

      {/* Title + description */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.35,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.6,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {description}
        </p>
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "var(--color-text-muted)",
                background: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 9999,
                padding: "3px 9px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

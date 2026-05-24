import { ExternalLink } from "lucide-react";

import type { LessonResource } from "../types";

type Props = { resource: LessonResource };

// Ressource liée à une leçon. Une ressource avec `cachedUrl: null`
// (supprimée côté Notion) n'est jamais rendue — voir ResourceList.
export function ResourceCard({ resource }: Props) {
  if (!resource.cachedUrl) return null;

  return (
    <a
      href={resource.cachedUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 16,
        padding: 16,
        textDecoration: "none",
        transition:
          "border-color 250ms ease, transform 250ms ease, box-shadow 250ms ease",
        boxShadow: "var(--nc-shadow-3)",
      }}
      className="hover:border-[rgba(224,98,90,0.32)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.06)]"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Badge>{resource.cachedType}</Badge>
        {resource.cachedFormation && (
          <Badge variant="muted">{resource.cachedFormation}</Badge>
        )}
      </div>

      <h4
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--color-text-primary)",
          lineHeight: 1.35,
          margin: 0,
        }}
      >
        {resource.cachedTitle}
      </h4>
      <p
        style={{
          fontSize: 12,
          color: "var(--color-text-secondary)",
          margin: 0,
          lineHeight: 1.45,
          flex: 1,
        }}
      >
        {resource.cachedDescription}
      </p>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-brand)",
          marginTop: 2,
        }}
      >
        Ouvrir la ressource
        <ExternalLink size={12} />
      </span>
    </a>
  );
}

function Badge({
  children,
  variant = "brand",
}: {
  children: React.ReactNode;
  variant?: "brand" | "muted";
}) {
  const brand = variant === "brand";
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: brand ? "var(--color-brand)" : "var(--color-text-muted)",
        background: brand
          ? "rgba(224,98,90,0.1)"
          : "var(--color-surface-raised)",
        border: brand
          ? "1px solid rgba(224,98,90,0.22)"
          : "1px solid var(--color-border-default)",
        borderRadius: 9999,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

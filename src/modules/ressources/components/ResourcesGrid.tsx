"use client";

import { useState, useMemo } from "react";
import type { Resource, ResourceType } from "../types";
import { ResourceCard } from "./ResourceCard";

const TYPE_FILTERS: { value: "all" | ResourceType; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "template", label: "Templates" },
  { value: "guide", label: "Guides" },
  { value: "redif", label: "Redifs" },
];

type Props = {
  resources: Resource[];
};

export function ResourcesGrid({ resources }: Props) {
  const [activeType, setActiveType] = useState<"all" | ResourceType>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeFormation, setActiveFormation] = useState<string | null>(null);

  const allTags = useMemo(
    () => Array.from(new Set(resources.flatMap((r) => r.tags))).sort(),
    [resources]
  );

  const allFormations = useMemo(
    () => Array.from(new Set(resources.map((r) => r.formation))).sort(),
    [resources]
  );

  const filtered = useMemo(
    () =>
      resources.filter((r) => {
        if (activeType !== "all" && r.type !== activeType) return false;
        if (activeTag && !r.tags.includes(activeTag)) return false;
        if (activeFormation && r.formation !== activeFormation) return false;
        return true;
      }),
    [resources, activeType, activeTag, activeFormation]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Primary filter — type */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {TYPE_FILTERS.map(({ value, label }) => {
          const isActive = activeType === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveType(value)}
              style={{
                padding: "7px 16px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                border: isActive
                  ? "1px solid var(--color-brand)"
                  : "1px solid var(--color-border-default)",
                background: isActive ? "var(--color-brand)" : "white",
                color: isActive ? "white" : "var(--color-text-secondary)",
                cursor: "pointer",
                transition: "all 150ms ease",
                boxShadow: isActive ? "var(--nc-shadow-3)" : "none",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Secondary filters — sujets + formations */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Sujets */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              flexShrink: 0,
              minWidth: 56,
            }}
          >
            Sujet
          </span>
          {allTags.map((tag) => {
            const isActive = activeTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(isActive ? null : tag)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  border: "1px solid var(--color-border-default)",
                  background: isActive ? "var(--color-surface-raised)" : "transparent",
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* Formations */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              flexShrink: 0,
              minWidth: 56,
            }}
          >
            Module
          </span>
          {allFormations.map((formation) => {
            const isActive = activeFormation === formation;
            return (
              <button
                key={formation}
                type="button"
                onClick={() => setActiveFormation(isActive ? null : formation)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 500,
                  border: "1px solid var(--color-border-default)",
                  background: isActive ? "var(--color-surface-raised)" : "transparent",
                  color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
              >
                {formation}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "var(--color-border-default)",
          margin: "0 -2px",
        }}
      />

      {/* Results count */}
      <p
        style={{
          fontSize: 13,
          color: "var(--color-text-muted)",
          margin: 0,
          marginTop: -8,
        }}
      >
        {filtered.length} ressource{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "48px 0",
            color: "var(--color-text-muted)",
          }}
        >
          <span style={{ fontSize: 32 }}>🔍</span>
          <p style={{ fontSize: 14, margin: 0 }}>Aucune ressource pour ces filtres.</p>
        </div>
      )}
    </div>
  );
}

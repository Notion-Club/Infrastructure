"use client";

import type { PostTag } from "../../types/post.types";

type TagFilter = PostTag | "all";

const FILTERS: Array<{ value: TagFilter; label: string }> = [
  { value: "all", label: "Général" },
  { value: "question", label: "Question" },
  { value: "presentation", label: "Présentation" },
  { value: "annonce", label: "Annonce" },
];

interface FeedTagFiltersProps {
  active: TagFilter;
  onChange: (tag: TagFilter) => void;
  onNewPost: () => void;
  isAdmin: boolean;
}

export function FeedTagFilters({ active, onChange, onNewPost, isAdmin }: FeedTagFiltersProps) {
  const filters = isAdmin ? FILTERS : FILTERS.filter((f) => f.value !== "annonce");

  return (
    <div
      data-fb-label="Filtres tags · Feed"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {filters.map((f) => {
          const isActive = active === f.value;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => onChange(f.value)}
              data-fb-label={`Filtre tag « ${f.label} » · Feed`}
              style={{
                /* Fixed min-width prevents layout shift when font-weight changes */
                minWidth: 90,
                padding: "7px 14px",
                borderRadius: 9999,
                border: isActive ? "1.5px solid var(--color-brand)" : "1px solid var(--color-border-default)",
                background: isActive ? "rgba(224,98,90,0.08)" : "var(--color-surface-card)",
                color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 180ms ease, border-color 180ms ease, color 180ms ease",
                whiteSpace: "nowrap",
                textAlign: "center",
              }}
              className={!isActive ? "hover:bg-[var(--nc-nav-hover-bg)]" : ""}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Desktop : bouton inline. Mobile : remplacé par un FAB flottant
          (cf. nc-feed-fab dans CommunityPage) → masqué ici en < md. */}
      <button
        type="button"
        onClick={onNewPost}
        data-fb-label="Bouton Nouveau post · Feed"
        className="nc-btn-shine hidden md:inline-flex"
        style={{
          alignItems: "center",
          gap: 6,
          padding: "8px 16px",
          background: "var(--color-brand)",
          color: "#fff",
          border: "none",
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "opacity 150ms ease",
          whiteSpace: "nowrap",
        }}
      >
        + Nouveau post
      </button>
    </div>
  );
}

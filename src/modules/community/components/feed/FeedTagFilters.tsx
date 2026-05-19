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
              style={{
                padding: "7px 14px",
                borderRadius: 9999,
                border: isActive ? "1.5px solid var(--color-brand)" : "1px solid var(--color-border-default)",
                background: isActive ? "rgba(224,98,90,0.08)" : "white",
                color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: "pointer",
                transition: "all 150ms ease",
                whiteSpace: "nowrap",
              }}
              className={!isActive ? "hover:bg-[rgba(0,0,0,0.04)]" : ""}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNewPost}
        className="nc-btn-shine"
        style={{
          display: "inline-flex",
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

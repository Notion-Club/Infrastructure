"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { SlidersHorizontal, Check } from "lucide-react";
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
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedFormations, setSelectedFormations] = useState<Set<string>>(new Set());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const allTags = useMemo(
    () => Array.from(new Set(resources.flatMap((r) => r.tags))).sort(),
    [resources]
  );

  const allFormations = useMemo(
    () => Array.from(new Set(resources.map((r) => r.formation))).sort(),
    [resources]
  );

  const activeFilterCount = selectedTags.size + selectedFormations.size;

  useEffect(() => {
    if (!dropdownOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [dropdownOpen]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }

  function toggleFormation(formation: string) {
    setSelectedFormations((prev) => {
      const next = new Set(prev);
      next.has(formation) ? next.delete(formation) : next.add(formation);
      return next;
    });
  }

  function clearFilters() {
    setSelectedTags(new Set());
    setSelectedFormations(new Set());
  }

  const filtered = useMemo(
    () =>
      resources.filter((r) => {
        if (activeType !== "all" && r.type !== activeType) return false;
        if (selectedTags.size > 0 && !r.tags.some((t) => selectedTags.has(t))) return false;
        if (selectedFormations.size > 0 && !selectedFormations.has(r.formation)) return false;
        return true;
      }),
    [resources, activeType, selectedTags, selectedFormations]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Type pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, flexWrap: "wrap" }}>
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

        {/* Filter dropdown trigger */}
        <div ref={dropdownRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 14px",
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 500,
              border:
                activeFilterCount > 0
                  ? "1px solid var(--color-brand)"
                  : "1px solid var(--color-border-default)",
              background: activeFilterCount > 0 ? "rgba(224,98,90,0.06)" : "white",
              color:
                activeFilterCount > 0 ? "var(--color-brand)" : "var(--color-text-secondary)",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
          >
            <SlidersHorizontal size={14} strokeWidth={2} />
            Filtres
            {activeFilterCount > 0 && (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  background: "var(--color-brand)",
                  color: "white",
                  borderRadius: 9999,
                  fontSize: 10,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                  lineHeight: 1,
                  marginLeft: 2,
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 260,
                background: "white",
                border: "1px solid var(--color-border-default)",
                borderRadius: 16,
                boxShadow: "var(--nc-shadow-2)",
                zIndex: 50,
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px 10px",
                  borderBottom: "1px solid var(--color-border-default)",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                  }}
                >
                  Filtres
                </span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    style={{
                      fontSize: 12,
                      color: "var(--color-brand)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontWeight: 500,
                    }}
                  >
                    Tout effacer
                  </button>
                )}
              </div>

              {/* Section Sujets */}
              <div style={{ padding: "10px 8px 4px" }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                    margin: "0 0 4px 8px",
                  }}
                >
                  Sujets
                </p>
                {allTags.map((tag) => {
                  const checked = selectedTags.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 120ms ease",
                      }}
                      className="hover:bg-[var(--color-surface-raised)]"
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 5,
                          border: checked
                            ? "none"
                            : "1.5px solid var(--color-border-default)",
                          background: checked ? "var(--color-brand)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 120ms ease",
                        }}
                      >
                        {checked && <Check size={10} strokeWidth={3} color="white" />}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--color-text-primary)",
                          fontWeight: checked ? 500 : 400,
                        }}
                      >
                        {tag}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: "var(--color-border-default)",
                  margin: "4px 0",
                }}
              />

              {/* Section Modules */}
              <div style={{ padding: "4px 8px 10px" }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-text-muted)",
                    margin: "6px 0 4px 8px",
                  }}
                >
                  Module de formation
                </p>
                {allFormations.map((formation) => {
                  const checked = selectedFormations.has(formation);
                  return (
                    <button
                      key={formation}
                      type="button"
                      onClick={() => toggleFormation(formation)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 10,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background 120ms ease",
                      }}
                      className="hover:bg-[var(--color-surface-raised)]"
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 5,
                          border: checked
                            ? "none"
                            : "1.5px solid var(--color-border-default)",
                          background: checked ? "var(--color-brand)" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 120ms ease",
                        }}
                      >
                        {checked && <Check size={10} strokeWidth={3} color="white" />}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--color-text-primary)",
                          fontWeight: checked ? 500 : 400,
                        }}
                      >
                        {formation}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results count */}
      <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
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

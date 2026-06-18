"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import {
  COUNTRIES,
  PRIORITY_COUNT,
  findCountryByCode,
  matchCountry,
  type Country,
} from "@/shared/lib/settings/countries";

// ============================================================================
// CountrySelect — sélecteur de pays riche (drapeau + recherche + clavier).
//
// Même UX que le `CountryPicker` du PhoneField (réglages → téléphone) : popup
// avec champ de recherche, bloc prioritaire (FR, BE, CH…) + reste alphabétique,
// navigation flèches/Entrée/Échap, fermeture au clic extérieur. Contrairement
// au picker téléphone (compact, préfixe d'indicatif), celui-ci occupe toute la
// largeur et affiche le NOM du pays — pensé pour un champ de formulaire
// autonome (ex. adresse de facturation). Le bouton réutilise l'allure
// `.nc-input` pour rester cohérent avec les autres champs de la carte.
// ============================================================================

const POPUP_HEIGHT = 320;
const DEFAULT_COUNTRY = "FR";

type CountrySelectProps = {
  id: string;
  label: string;
  /** Code ISO 3166-1 alpha-2 (ex. "FR"). */
  value: string;
  onChange: (code: string) => void;
  fbLabel?: string;
};

export function CountrySelect({
  id,
  label,
  value,
  onChange,
  fbLabel,
}: CountrySelectProps) {
  const selected =
    findCountryByCode(value) ?? findCountryByCode(DEFAULT_COUNTRY)!;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closePicker();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  const { priority, rest } = useMemo(() => {
    if (!query.trim()) {
      return {
        priority: COUNTRIES.slice(0, PRIORITY_COUNT),
        rest: COUNTRIES.slice(PRIORITY_COUNT),
      };
    }
    // En recherche : liste unique classée, sans le split prioritaire/reste.
    return {
      priority: [] as Country[],
      rest: COUNTRIES.filter((country) => matchCountry(query, country)),
    };
  }, [query]);

  const visibleFlat = useMemo(
    () => [...priority, ...rest],
    [priority, rest],
  );

  const safeHighlight =
    visibleFlat.length === 0
      ? 0
      : Math.min(highlightIdx, visibleFlat.length - 1);

  function closePicker() {
    setOpen(false);
    setQuery("");
    setHighlightIdx(0);
  }

  function pick(country: Country) {
    onChange(country.code);
    closePicker();
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx(Math.min(safeHighlight + 1, visibleFlat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx(Math.max(safeHighlight - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const country = visibleFlat[safeHighlight];
      if (country) pick(country);
    } else if (e.key === "Escape") {
      closePicker();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--color-text-secondary)",
        }}
      >
        {label}
      </label>

      <div ref={containerRef} style={{ position: "relative" }}>
        <button
          type="button"
          id={id}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          data-fb-label={fbLabel ?? "Sélecteur pays"}
          className="nc-input"
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span aria-hidden style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
            {selected.flag}
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--color-text-primary)",
            }}
          >
            {selected.name}
          </span>
          <ChevronDown
            size={16}
            style={{
              color: "var(--color-text-muted)",
              flexShrink: 0,
              transition: "transform 150ms ease",
              transform: open ? "rotate(180deg)" : "none",
            }}
          />
        </button>

        {open && (
          <div
            role="dialog"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              width: "100%",
              background: "var(--color-surface-card)",
              border: "1px solid var(--color-border-default)",
              borderRadius: 14,
              boxShadow: "var(--nc-shadow-2)",
              zIndex: 70,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: 10,
                borderBottom: "1px solid var(--color-border-default)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Search
                size={14}
                style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlightIdx(0);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder="Rechercher un pays…"
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  background: "transparent",
                  color: "var(--color-text-primary)",
                  minWidth: 0,
                }}
              />
            </div>
            <ul
              role="listbox"
              style={{
                listStyle: "none",
                margin: 0,
                padding: 6,
                overflowY: "auto",
                maxHeight: POPUP_HEIGHT,
              }}
            >
              {priority.map((country, idx) => (
                <CountryRow
                  key={`p-${country.code}`}
                  country={country}
                  selected={country.code === selected.code}
                  highlighted={safeHighlight === idx}
                  onClick={() => pick(country)}
                />
              ))}
              {priority.length > 0 && rest.length > 0 && (
                <li
                  aria-hidden
                  style={{
                    height: 1,
                    background: "var(--color-border-default)",
                    margin: "6px 8px",
                  }}
                />
              )}
              {rest.map((country, idx) => {
                const flatIdx = priority.length + idx;
                return (
                  <CountryRow
                    key={`r-${country.code}`}
                    country={country}
                    selected={country.code === selected.code}
                    highlighted={safeHighlight === flatIdx}
                    onClick={() => pick(country)}
                  />
                );
              })}
              {visibleFlat.length === 0 && (
                <li
                  style={{
                    padding: "16px 10px",
                    fontSize: 13,
                    color: "var(--color-text-muted)",
                    textAlign: "center",
                  }}
                >
                  Aucun pays trouvé
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function CountryRow({
  country,
  selected,
  highlighted,
  onClick,
}: {
  country: Country;
  selected: boolean;
  highlighted: boolean;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 8,
    cursor: "pointer",
    background: highlighted ? "var(--color-surface-raised)" : "transparent",
    fontSize: 13,
    color: "var(--color-text-primary)",
  };
  return (
    <li role="option" aria-selected={selected} style={style} onClick={onClick}>
      <span aria-hidden style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
        {country.flag}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {country.name}
      </span>
      {selected && (
        <Check size={14} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
      )}
    </li>
  );
}

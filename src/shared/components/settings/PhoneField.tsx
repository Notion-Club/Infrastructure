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
  findCountryByDial,
  matchCountry,
  type Country,
} from "@/shared/lib/settings/countries";

export type PhoneValue = {
  countryCode: string;
  national: string;
};

const DEFAULT_COUNTRY = "FR";

// Parses a stored phone (e.g. "+33 6 12 34 56 78") into {country, national}.
// Falls back to FR if no recognizable prefix.
export function parsePhone(stored: string | null | undefined): PhoneValue {
  if (!stored || !stored.trim()) {
    return { countryCode: DEFAULT_COUNTRY, national: "" };
  }
  const trimmed = stored.trim();
  if (!trimmed.startsWith("+")) {
    return { countryCode: DEFAULT_COUNTRY, national: trimmed };
  }
  const compact = trimmed.replace(/\s+/g, "");
  const match = findCountryByDial(compact);
  if (!match) {
    return { countryCode: DEFAULT_COUNTRY, national: trimmed };
  }
  const national = compact.slice(match.dial.length).replace(/^[\s-]+/, "");
  return { countryCode: match.code, national };
}

export function formatPhone(value: PhoneValue): string {
  const country = findCountryByCode(value.countryCode);
  if (!country) return value.national;
  const national = value.national.trim();
  if (!national) return "";
  return `${country.dial} ${national}`;
}

type PhoneFieldProps = {
  id: string;
  label: string;
  value: PhoneValue;
  onChange: (next: PhoneValue) => void;
  helper?: string;
};

export function PhoneField({
  id,
  label,
  value,
  onChange,
  helper,
}: PhoneFieldProps) {
  const selected =
    findCountryByCode(value.countryCode) ??
    findCountryByCode(DEFAULT_COUNTRY)!;

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
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "stretch",
        }}
      >
        <CountryPicker
          selected={selected}
          onSelect={(country) =>
            onChange({ countryCode: country.code, national: value.national })
          }
        />
        <input
          id={id}
          name={id}
          type="tel"
          inputMode="tel"
          value={value.national}
          onChange={(e) =>
            onChange({
              countryCode: value.countryCode,
              national: e.target.value.replace(/[^\d\s\-]/g, ""),
            })
          }
          autoComplete="tel-national"
          placeholder="6 12 34 56 78"
          className="nc-input"
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
      {helper && (
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
          }}
        >
          {helper}
        </p>
      )}
    </div>
  );
}

/* --------------------------- CountryPicker --------------------------- */

const POPUP_HEIGHT = 320;

function CountryPicker({
  selected,
  onSelect,
}: {
  selected: Country;
  onSelect: (country: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePicker();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(t);
  }, [open]);

  const { priority, rest } = useMemo(() => {
    const filtered = COUNTRIES.filter((c) => matchCountry(query, c));
    if (!query.trim()) {
      return {
        priority: COUNTRIES.slice(0, PRIORITY_COUNT),
        rest: COUNTRIES.slice(PRIORITY_COUNT),
      };
    }
    // While searching, drop the priority/rest split — single ranked list.
    return { priority: [] as Country[], rest: filtered };
  }, [query]);

  const visibleFlat = useMemo(
    () => [...priority, ...rest],
    [priority, rest],
  );

  // Clamp the highlight so it can't point past the end of the filtered list.
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
    onSelect(country);
    closePicker();
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
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
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "0 12px",
          height: 44,
          borderRadius: 12,
          border: "1px solid var(--color-border-default)",
          background: "white",
          color: "var(--color-text-primary)",
          fontSize: 14,
          cursor: "pointer",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
          {selected.flag}
        </span>
        <span style={{ fontWeight: 500 }}>{selected.dial}</span>
        <ChevronDown
          size={14}
          style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
        />
      </button>

      {open && (
        <div
          role="dialog"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            background: "white",
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
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlightIdx(0);
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Rechercher un pays ou un préfixe…"
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
            ref={listRef}
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
                  key={`r-${country.code}-${country.dial}`}
                  country={country}
                  selected={country.code === selected.code}
                  highlighted={safeHighlight === flatIdx}
                  onClick={() => pick(country)}
                />
              );
            })}
            {rest.length === 0 && priority.length === 0 && (
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
    background: highlighted
      ? "var(--color-surface-raised)"
      : "transparent",
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
      <span
        style={{
          fontSize: 12,
          color: "var(--color-text-muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {country.dial}
      </span>
      {selected && (
        <Check
          size={14}
          style={{ color: "var(--color-brand)", flexShrink: 0 }}
        />
      )}
    </li>
  );
}

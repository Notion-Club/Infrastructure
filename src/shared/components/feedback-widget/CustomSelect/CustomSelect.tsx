"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import styles from "./CustomSelect.module.css";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  name: string;
  label?: string;
  required?: boolean;
  options: Option[];
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export default function CustomSelect({
  id,
  name,
  label,
  required = false,
  options,
  placeholder = "Sélectionner...",
  value: controlledValue,
  onChange,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reactId = useId();
  const inputId = id ?? `select-${reactId}`;
  const listboxId = `${inputId}-listbox`;

  useEffect(() => {
    if (controlledValue !== undefined) {
      const opt = options.find((o) => o.value === controlledValue) ?? null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelected(opt);
    }
  }, [controlledValue, options]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function selectOption(opt: Option) {
    setSelected(opt);
    onChange?.(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(selected ? options.findIndex((o) => o.value === selected.value) : 0);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Home") { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === "End") { e.preventDefault(); setActiveIndex(options.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); selectOption(options[activeIndex]); }
  }

  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}{required ? <span aria-hidden="true"> *</span> : null}
        </label>
      )}
      <div ref={rootRef} className={styles.wrapper}>
        <button
          ref={triggerRef}
          id={inputId}
          type="button"
          className={styles.trigger}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-required={required}
          onClick={() => {
            setOpen((o) => !o);
            setActiveIndex(selected ? options.findIndex((o) => o.value === selected.value) : 0);
          }}
          onKeyDown={onTriggerKeyDown}
        >
          <span className={selected ? styles.triggerValue : styles.triggerPlaceholder}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={15} aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
        </button>

        <input type="hidden" name={name} value={selected?.value ?? ""} />

        {open && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            className={styles.menu}
            onKeyDown={onListKeyDown}
            aria-activedescendant={`${inputId}-opt-${activeIndex}`}
          >
            {options.map((opt, i) => (
              <li
                key={opt.value}
                id={`${inputId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={selected?.value === opt.value}
                className={`${styles.option} ${activeIndex === i ? styles.optionActive : ""}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
              >
                <span className={styles.optionLabel}>{opt.label}</span>
                {selected?.value === opt.value && <Check size={14} className={styles.optionCheck} aria-hidden="true" />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

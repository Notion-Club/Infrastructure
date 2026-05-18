"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

type EmailFieldProps = {
  platformEmail: string;
  notionEmail: string;
  // Whether the "use a different email for Notion" mode is active.
  // When false, the platform email is implicitly used for Notion as well.
  useSeparateNotionEmail: boolean;
  onPlatformEmailChange: (value: string) => void;
  onNotionEmailChange: (value: string) => void;
  onToggleSeparateNotion: (enabled: boolean) => void;
};

export function EmailField({
  platformEmail,
  notionEmail,
  useSeparateNotionEmail,
  onPlatformEmailChange,
  onNotionEmailChange,
  onToggleSeparateNotion,
}: EmailFieldProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    if (!innerRef.current) return;
    const el = innerRef.current;
    const update = () => setInnerHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const animateOpen = useSeparateNotionEmail;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        border: "1px solid var(--color-border-default)",
        overflow: "hidden",
        background: "white",
      }}
    >
      {/* Top half — platform email */}
      <div
        style={{
          padding: "14px 14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          background: "white",
        }}
      >
        <label
          htmlFor="platform-email"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-secondary)",
          }}
        >
          Email Notion Club
        </label>
        <input
          id="platform-email"
          name="platform-email"
          type="email"
          value={platformEmail}
          onChange={(e) => onPlatformEmailChange(e.target.value)}
          autoComplete="email"
          className="nc-input"
          placeholder="vous@exemple.com"
          style={{ background: "white" }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
          }}
        >
          Utilisé pour vous connecter et pour les invitations Notion par défaut.
        </p>
      </div>

      {/* Bottom half — contrasted background */}
      <div
        style={{
          background: "var(--color-surface-raised)",
          borderTop: "1px solid var(--color-border-default)",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Checkbox
          label="J'utilise un mail différent pour mon compte Notion"
          checked={useSeparateNotionEmail}
          onChange={(v) => onToggleSeparateNotion(v)}
        />

        <div
          style={{
            overflow: "hidden",
            transition: "max-height 220ms ease, opacity 180ms ease",
            maxHeight: animateOpen ? innerHeight + 4 : 0,
            opacity: animateOpen ? 1 : 0,
          }}
        >
          <div
            ref={innerRef}
            style={{
              paddingTop: 4,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <label
              htmlFor="notion-email"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--color-text-secondary)",
              }}
            >
              Email utilisé pour Notion
            </label>
            <input
              id="notion-email"
              name="notion-email"
              type="email"
              value={notionEmail}
              onChange={(e) => onNotionEmailChange(e.target.value)}
              autoComplete="email"
              className="nc-input"
              placeholder="vous@notion.com"
              disabled={!useSeparateNotionEmail}
              style={{ background: "white" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        fontSize: 13,
        color: "var(--color-text-primary)",
        lineHeight: 1.4,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          border: checked
            ? "1.5px solid var(--color-brand)"
            : "1.5px solid var(--color-border-default)",
          background: checked ? "var(--color-brand)" : "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          transition: "all 150ms ease",
          flexShrink: 0,
        }}
      >
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
      />
      <span>{label}</span>
    </label>
  );
}

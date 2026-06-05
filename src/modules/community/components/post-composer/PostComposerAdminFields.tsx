"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { PostAudience } from "../../types/post.types";

const DURATION_OPTIONS = ["24h", "7 jours", "Permanent"];

interface PostComposerAdminFieldsProps {
  audience: PostAudience | null;
  onAudienceChange: (a: PostAudience) => void;
  pinned: boolean;
  onPinnedChange: (v: boolean) => void;
  pinnedDuration: string;
  onPinnedDurationChange: (v: string) => void;
  notifyAll: boolean;
  onNotifyAllChange: (v: boolean) => void;
}

export function PostComposerAdminFields({
  audience,
  onAudienceChange,
  pinned,
  onPinnedChange,
  pinnedDuration,
  onPinnedDurationChange,
  notifyAll,
  onNotifyAllChange,
}: PostComposerAdminFieldsProps) {
  const [durationOpen, setDurationOpen] = useState(false);
  const durationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!durationOpen) return;
    function close(e: MouseEvent) {
      if (durationRef.current && !durationRef.current.contains(e.target as Node)) setDurationOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [durationOpen]);

  const AUDIENCES: Array<{ value: PostAudience; label: string }> = [
    { value: "all", label: "Tout le monde" },
    { value: "free_only", label: "Free uniquement" },
    { value: "paid_only", label: "Payants uniquement" },
  ];

  return (
    <div
      data-fb-label="Options admin · Composer de post"
      style={{
        background: "rgba(224,98,90,0.04)",
        border: "1px solid rgba(224,98,90,0.15)",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "var(--color-brand)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Options admin
      </p>

      {/* Audience */}
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", display: "block", marginBottom: 8 }}>
          Audience <span style={{ color: "var(--color-brand)" }}>*</span>
        </label>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {AUDIENCES.map((a) => (
            <label
              key={a.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 13,
                color: "var(--color-text-primary)",
              }}
            >
              <input
                type="radio"
                name="audience"
                value={a.value}
                checked={audience === a.value}
                onChange={() => onAudienceChange(a.value)}
                style={{ accentColor: "var(--color-brand)" }}
              />
              {a.label}
            </label>
          ))}
        </div>
      </div>

      {/* Épingler */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => onPinnedChange(e.target.checked)}
            style={{ accentColor: "var(--color-brand)" }}
          />
          Épingler ce post
        </label>

        {pinned && (
          <div ref={durationRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setDurationOpen((o) => !o)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 10px", border: "1px solid var(--color-border-default)",
                borderRadius: 9999, background: "var(--color-surface-card)", fontSize: 12,
                color: "var(--color-text-primary)", cursor: "pointer",
              }}
            >
              {pinnedDuration} <ChevronDown size={12} />
            </button>
            {durationOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0,
                background: "var(--color-surface-card)", border: "1px solid var(--color-border-default)",
                borderRadius: 10, boxShadow: "var(--nc-shadow-3)", padding: 4, zIndex: 100,
              }}>
                {DURATION_OPTIONS.map((d) => (
                  <button key={d} type="button"
                    onClick={() => { onPinnedDurationChange(d); setDurationOpen(false); }}
                    style={{
                      display: "block", width: "100%", padding: "7px 12px",
                      fontSize: 13, background: d === pinnedDuration ? "rgba(224,98,90,0.08)" : "transparent",
                      border: "none", borderRadius: 7, cursor: "pointer",
                      color: d === pinnedDuration ? "var(--color-brand)" : "var(--color-text-primary)",
                      textAlign: "left",
                    }}
                    className={d !== pinnedDuration ? "hover:bg-[#f5f5f5]" : ""}
                  >{d}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notifier */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "var(--color-text-primary)" }}>
        <input
          type="checkbox"
          checked={notifyAll}
          onChange={(e) => onNotifyAllChange(e.target.checked)}
          style={{ accentColor: "var(--color-brand)" }}
        />
        Notifier tout le monde
      </label>
    </div>
  );
}

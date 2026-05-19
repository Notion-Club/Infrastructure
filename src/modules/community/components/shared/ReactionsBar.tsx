"use client";

import { useState, useRef, useCallback } from "react";
import type { Reaction } from "../../types/post.types";
import { MOCK_USERS } from "../../mocks/users.mock";

// Generate a plausible list of reactor names for a given emoji + count
function getMockReactors(emoji: string, count: number): string[] {
  const seed = emoji.codePointAt(0) ?? 0;
  const users = MOCK_USERS.filter((u) => !u.deleted && !u.id.startsWith("self-"));
  const names: string[] = [];
  for (let i = 0; i < Math.min(count, 6); i++) {
    names.push(users[(seed + i) % users.length].name);
  }
  return names;
}

interface ReactionPillProps {
  emoji: string;
  count: number;
  userReacted: boolean;
  compact: boolean;
}

function ReactionPill({ emoji, count, userReacted, compact }: ReactionPillProps) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reactors = getMockReactors(emoji, count);

  const onEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setHovered(true), 150);
  }, []);

  const onLeave = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 200);
  }, []);

  return (
    <span
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: compact ? 12 : 13,
        color: userReacted ? "var(--color-brand)" : "var(--color-text-secondary)",
        fontWeight: userReacted ? 600 : 500,
        cursor: "pointer",
        padding: compact ? "2px 7px" : "3px 9px",
        borderRadius: 9999,
        background: userReacted ? "rgba(224,98,90,0.08)" : "white",
        border: `1px solid ${userReacted ? "rgba(224,98,90,0.25)" : "var(--color-border-default)"}`,
        transition: "background 150ms ease, border-color 150ms ease",
        userSelect: "none",
      }}
      className="hover:border-[rgba(0,0,0,0.15)]"
    >
      {emoji}
      <span>{count}</span>

      {/* Hover popover — who reacted */}
      {hovered && (
        <div
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "white",
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            boxShadow: "var(--nc-shadow-2)",
            padding: "8px 10px",
            minWidth: 160,
            zIndex: 200,
            animation: "nc-mode-in 150ms var(--nc-ease) both",
            pointerEvents: "auto",
          }}
        >
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {emoji} {count} réaction{count !== 1 ? "s" : ""}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {reactors.map((name) => {
              const user = MOCK_USERS.find((u) => u.name === name);
              const initials = user?.initials ?? name.slice(0, 2).toUpperCase();
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#e0625a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500 }}>
                    {name}
                  </span>
                </div>
              );
            })}
            {count > 6 && (
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
                + {count - 6} autre{count - 6 > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

interface ReactionsBarProps {
  reactions: Reaction[];
  commentCount?: number;
  compact?: boolean;
}

export function ReactionsBar({ reactions, commentCount, compact = false }: ReactionsBarProps) {
  const nonEmpty = reactions.filter((r) => r.count > 0);
  const total = nonEmpty.reduce((s, r) => s + r.count, 0);

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
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        {nonEmpty.length === 0 ? null : nonEmpty.length <= 3 ? (
          /* Individual pill per emoji */
          nonEmpty.map((r) => (
            <ReactionPill
              key={r.emoji}
              emoji={r.emoji}
              count={r.count}
              userReacted={r.userReacted}
              compact={compact}
            />
          ))
        ) : (
          /* Grouped pill when >3 */
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: compact ? 12 : 13,
              color: "var(--color-text-secondary)",
              fontWeight: 500,
              cursor: "pointer",
              padding: compact ? "2px 9px" : "3px 11px",
              borderRadius: 9999,
              background: "white",
              border: "1px solid var(--color-border-default)",
              transition: "border-color 150ms ease",
            }}
            className="hover:border-[rgba(0,0,0,0.15)]"
          >
            <span style={{ letterSpacing: "-0.02em" }}>
              {nonEmpty.slice(0, 3).map((r) => r.emoji).join("")}
            </span>
            <span style={{ fontWeight: 600 }}>{total}</span>
          </span>
        )}
      </div>

      {commentCount !== undefined && (
        <span
          style={{
            fontSize: compact ? 12 : 13,
            color: "var(--color-text-muted)",
          }}
        >
          💬 {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

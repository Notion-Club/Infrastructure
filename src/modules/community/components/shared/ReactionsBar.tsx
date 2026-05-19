"use client";

import type { Reaction } from "../../types/post.types";

interface ReactionsBarProps {
  reactions: Reaction[];
  commentCount?: number;
  compact?: boolean;
}

export function ReactionsBar({ reactions, commentCount, compact = false }: ReactionsBarProps) {
  const nonEmpty = reactions.filter((r) => r.count > 0);

  const reactionBlock =
    nonEmpty.length <= 3 ? (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {nonEmpty.map((r) => (
          <span
            key={r.emoji}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: compact ? 12 : 13,
              color: r.userReacted ? "var(--color-brand)" : "var(--color-text-secondary)",
              fontWeight: r.userReacted ? 600 : 400,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 9999,
              background: r.userReacted ? "rgba(224,98,90,0.08)" : "transparent",
              transition: "background 150ms ease",
            }}
            className="hover:bg-[rgba(0,0,0,0.04)]"
          >
            {r.emoji} <span>{r.count}</span>
          </span>
        ))}
      </div>
    ) : (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: compact ? 12 : 13,
          color: "var(--color-text-secondary)",
          cursor: "pointer",
        }}
        className="hover:bg-[rgba(0,0,0,0.04)]"
      >
        {nonEmpty.slice(0, 3).map((r) => r.emoji).join("")}{" "}
        <span>{nonEmpty.reduce((s, r) => s + r.count, 0)}</span>
      </span>
    );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <div>{nonEmpty.length > 0 ? reactionBlock : null}</div>
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

"use client";

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Reaction } from "../../types/post.types";
import { MOCK_USERS } from "../../mocks/users.mock";

function getMockReactors(emoji: string, count: number): Array<{ name: string; initials: string }> {
  const seed = emoji.codePointAt(0) ?? 0;
  const users = MOCK_USERS.filter((u) => !u.deleted && !u.id.startsWith("self-"));
  return Array.from({ length: count }, (_, i) => {
    const u = users[(seed + i) % users.length];
    return { name: u.name, initials: u.initials ?? u.name.slice(0, 2).toUpperCase() };
  });
}

function getAllReactors(reactions: Reaction[]): Array<{ name: string; initials: string; emoji: string }> {
  return reactions.flatMap((r) =>
    getMockReactors(r.emoji, r.count).map((u) => ({ ...u, emoji: r.emoji }))
  );
}

function AvatarDot({ initials }: { initials: string }) {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: "50%", background: "#e0625a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function BottomSheet({ reactions, onClose }: { reactions: Reaction[]; onClose: () => void }) {
  const all = getAllReactors(reactions.filter((r) => r.count > 0));
  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 5000, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-surface-card)", borderRadius: "20px 20px 0 0",
          padding: "20px 16px 32px", width: "100%",
          maxHeight: "60dvh", overflowY: "auto",
          animation: "nc-sheet-in 300ms ease both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 9999, background: "var(--color-border-default)", margin: "0 auto 16px" }} />
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)" }}>
          {all.length} réaction{all.length !== 1 ? "s" : ""}
        </p>
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          {reactions.filter((r) => r.count > 0).map((r) => (
            <span key={r.emoji} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
              {r.emoji} <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>{r.count}</span>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {all.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AvatarDot initials={r.initials} />
                <span style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>{r.name}</span>
              </div>
              <span style={{ fontSize: 18 }}>{r.emoji}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

interface ReactionPillProps {
  emoji: string;
  count: number;
  userReacted: boolean;
  compact: boolean;
  onReact?: () => void;
  allReactions: Reaction[];
}

function ReactionPill({ emoji, count, userReacted, compact, onReact, allReactions }: ReactionPillProps) {
  const [hovered, setHovered] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reactors = getMockReactors(emoji, count);

  const onEnter = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setHovered(true), 150);
  }, []);

  const onLeave = useCallback(() => {
    if (showTimer.current) clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), 200);
  }, []);

  function onPressDown() {
    pressTimer.current = setTimeout(() => { setHovered(false); setShowSheet(true); }, 500);
  }
  function onPressUp() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  return (
    <>
      <span
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onReact}
        onPointerDown={onPressDown}
        onPointerUp={onPressUp}
        onPointerCancel={onPressUp}
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

        {hovered && (
          <div
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            style={{
              position: "absolute",
              bottom: "calc(100% + 6px)",
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--color-surface-card)",
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
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 200, overflowY: "auto" }}>
              {reactors.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <AvatarDot initials={r.initials} />
                  <span style={{ fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500 }}>{r.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </span>

      {showSheet && <BottomSheet reactions={allReactions} onClose={() => setShowSheet(false)} />}
    </>
  );
}

interface ReactionsBarProps {
  reactions: Reaction[];
  commentCount?: number;
  compact?: boolean;
  onReact?: (emoji: string) => void;
  onCommentClick?: () => void;
}

export function ReactionsBar({ reactions, commentCount, compact = false, onReact, onCommentClick }: ReactionsBarProps) {
  const nonEmpty = reactions.filter((r) => r.count > 0);
  const total = nonEmpty.reduce((s, r) => s + r.count, 0);
  const userReactedReaction = nonEmpty.find((r) => r.userReacted);
  const userHasReacted = !!userReactedReaction;
  const [showGroupSheet, setShowGroupSheet] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onGroupPressDown() {
    pressTimer.current = setTimeout(() => setShowGroupSheet(true), 500);
  }
  function onGroupPressUp() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        {nonEmpty.length === 0 ? null : nonEmpty.length <= 3 ? (
          nonEmpty.map((r) => (
            <ReactionPill
              key={r.emoji}
              emoji={r.emoji}
              count={r.count}
              userReacted={r.userReacted}
              compact={compact}
              onReact={onReact ? () => onReact(r.emoji) : undefined}
              allReactions={reactions}
            />
          ))
        ) : (
          <span
            onClick={() => userReactedReaction ? onReact?.(userReactedReaction.emoji) : undefined}
            onPointerDown={onGroupPressDown}
            onPointerUp={onGroupPressUp}
            onPointerCancel={onGroupPressUp}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: compact ? 12 : 13,
              color: userHasReacted ? "var(--color-brand)" : "var(--color-text-secondary)",
              fontWeight: userHasReacted ? 600 : 500,
              cursor: "pointer",
              padding: compact ? "2px 9px" : "3px 11px",
              borderRadius: 9999,
              background: userHasReacted ? "rgba(224,98,90,0.08)" : "white",
              border: `1px solid ${userHasReacted ? "rgba(224,98,90,0.25)" : "var(--color-border-default)"}`,
              transition: "border-color 150ms ease, background 150ms ease",
              userSelect: "none",
            }}
            className="hover:border-[rgba(0,0,0,0.15)]"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {nonEmpty.slice(0, 3).map((r) => <span key={r.emoji}>{r.emoji}</span>)}
            </span>
            <span style={{ fontWeight: 600 }}>{total}</span>
          </span>
        )}
      </div>

      {commentCount !== undefined && (
        onCommentClick ? (
          <button
            type="button"
            onClick={onCommentClick}
            style={{
              fontSize: compact ? 12 : 13,
              color: "var(--color-text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontFamily: "inherit",
              transition: "color 150ms ease",
            }}
            className="hover:text-[var(--color-text-primary)]"
          >
            💬 {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
          </button>
        ) : (
          <span style={{ fontSize: compact ? 12 : 13, color: "var(--color-text-muted)" }}>
            💬 {commentCount} commentaire{commentCount !== 1 ? "s" : ""}
          </span>
        )
      )}

      {showGroupSheet && <BottomSheet reactions={nonEmpty} onClose={() => setShowGroupSheet(false)} />}
    </div>
  );
}

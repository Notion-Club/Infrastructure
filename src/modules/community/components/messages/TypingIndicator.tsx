"use client";

// 3 points qui pulsent dans une bulle "reçue" style — mêmes radius/colors
// que MessageBubble pour cohérence visuelle. Animation CSS pure (pas de JS
// frame loop). delay décalé sur chaque dot pour effet onde.

interface TypingIndicatorProps {
  // Nom de l'autre participant — affiché en label discret au-dessus.
  authorName: string;
}

export function TypingIndicator({ authorName }: TypingIndicatorProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        margin: "2px 0",
        gap: 2,
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text-muted)",
          paddingLeft: 14,
        }}
      >
        {authorName} écrit…
      </span>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: "16px 16px 16px 4px",
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Dot delay="0s" />
        <Dot delay="0.15s" />
        <Dot delay="0.3s" />
        <style>{`
          @keyframes nc-typing-bounce {
            0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
            30% { transform: translateY(-4px); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--color-text-muted)",
        display: "inline-block",
        animation: "nc-typing-bounce 1s ease-in-out infinite",
        animationDelay: delay,
      }}
    />
  );
}

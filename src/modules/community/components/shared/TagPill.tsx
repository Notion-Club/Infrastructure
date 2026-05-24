import type { PostTag } from "../../types/post.types";

const TAG_CONFIG: Record<PostTag, { label: string; bg: string; color: string }> = {
  general: { label: "Général", bg: "rgba(0,0,0,0.06)", color: "var(--color-text-secondary)" },
  question: { label: "Question", bg: "rgba(59,130,246,0.10)", color: "#1d4ed8" },
  presentation: { label: "Présentation", bg: "rgba(34,197,94,0.10)", color: "#15803d" },
  annonce: { label: "Annonce", bg: "rgba(224,98,90,0.12)", color: "#c0392b" },
};

interface TagPillProps {
  tag: PostTag;
  size?: "sm" | "md";
}

export function TagPill({ tag, size = "md" }: TagPillProps) {
  const config = TAG_CONFIG[tag];
  const py = size === "sm" ? 2 : 3;
  const px = size === "sm" ? 8 : 10;
  const fs = size === "sm" ? 11 : 12;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: `${py}px ${px}px`,
        borderRadius: 9999,
        fontSize: fs,
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        whiteSpace: "nowrap",
        letterSpacing: "0.01em",
      }}
    >
      {config.label}
    </span>
  );
}

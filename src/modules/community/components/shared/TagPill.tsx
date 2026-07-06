import type { PostTag } from "../../types/post.types";

const TAG_CONFIG: Record<PostTag, { label: string; bg: string; color: string }> = {
  general: { label: "Général", bg: "var(--nc-tag-general-bg)", color: "var(--nc-tag-general-text)" },
  question: { label: "Question", bg: "var(--nc-tag-question-bg)", color: "var(--nc-tag-question-text)" },
  presentation: { label: "Présentation", bg: "var(--nc-tag-presentation-bg)", color: "var(--nc-tag-presentation-text)" },
  annonce: { label: "Annonce", bg: "var(--nc-tag-annonce-bg)", color: "var(--nc-tag-annonce-text)" },
};

interface TagPillProps {
  tag: PostTag;
  size?: "xs" | "sm" | "md";
}

export function TagPill({ tag, size = "md" }: TagPillProps) {
  const config = TAG_CONFIG[tag];
  const py = size === "xs" ? 1 : size === "sm" ? 2 : 3;
  const px = size === "xs" ? 7 : size === "sm" ? 8 : 10;
  const fs = size === "xs" ? 10 : size === "sm" ? 11 : 12;

  return (
    <span
      data-fb-label={`Badge tag « ${config.label} » · Communauté`}
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

"use client";

import type { NotionBlock } from "@/shared/lib/notion/blocks";
import { toEmbedSrc } from "@/shared/lib/notion/video";
import type { LessonResourceLink } from "../server/notion";
import { NotionBlocks } from "./notion/NotionBlocks";
import { LessonFeedback } from "./LessonFeedback";
import { LessonNotebook } from "./LessonNotebook";

type Props = {
  title: string;
  description: string | null;
  videoUrl: string | null;
  blocks: NotionBlock[];
  formationName: string;
  moduleName: string;
  synthese: string;
  resources: LessonResourceLink[];
  courseId: string;
  noteContent: string;
};

// Carte « player » — un seul bloc : (1) titre + description (+ pill feedback),
// (2) player vidéo full-bleed + body du cours, (3) carnet (switcher notes /
// synthèse / ressources) attaché en fin de carte.
export function LessonPlayerCard({
  title,
  description,
  videoUrl,
  blocks,
  formationName,
  moduleName,
  synthese,
  resources,
  courseId,
  noteContent,
}: Props) {
  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "var(--nc-shadow-2)",
        viewTransitionName: "lesson-card",
      }}
    >
      {/* 1 — Titre + description (+ pill feedback) */}
      <div style={{ padding: "22px 24px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "var(--color-text-primary)",
              margin: 0,
              lineHeight: 1.2,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </h1>
          <LessonFeedback
            courseName={title}
            formationName={formationName}
            moduleName={moduleName}
          />
        </div>
        {description && (
          <p
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--color-text-secondary)",
              margin: "8px 0 0 0",
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* 2 — Player full-bleed (aucune marge latérale) */}
      <VideoEmbed url={videoUrl} title={title} />

      {/* Body du cours (tout le contenu Notion hors vidéo) */}
      {blocks.length > 0 && (
        <div style={{ padding: "18px 24px 22px" }}>
          <NotionBlocks blocks={blocks} />
        </div>
      )}

      {/* 3 — Switcher : pleine largeur, collé à ras en bas (3e partie de la carte) */}
      <LessonNotebook
        synthese={synthese}
        resources={resources}
        courseId={courseId}
        initialNote={noteContent}
      />
    </div>
  );
}

// ─── Vidéo (full-bleed) ──────────────────────────────────────────────────

function VideoEmbed({ url, title }: { url: string | null; title: string }) {
  if (!url) return null;
  const isFile = /\.(mp4|webm|mov)(\?|$)/i.test(url) && !url.includes("tella.tv");
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000" }}>
      {isFile ? (
        <video src={url} controls style={{ width: "100%", height: "100%" }} />
      ) : (
        <iframe
          src={toEmbedSrc(url)}
          title={title}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      )}
    </div>
  );
}

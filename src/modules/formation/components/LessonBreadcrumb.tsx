"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  ListTree,
  Lock,
  PlayCircle,
} from "lucide-react";

import { MorphMenu } from "@/shared/components/MorphMenu";
import { Tree, Folder, File } from "@/shared/components/ui/file-tree";
import { startLessonTransition } from "./LessonTransition";
import type { LessonTreeModule } from "../types";

type Props = {
  formation: { slug: string; name: string };
  currentModuleSlug: string;
  currentCourseSlug: string;
  courseName: string;
  tree: LessonTreeModule[];
};

// Fil d'Ariane des leçons : un déclencheur (icône + module courant) qui SE
// TRANSFORME (morph) en file-tree (modules → cours) de toute la formation pour
// naviguer librement. La pilule de largeur variable est mesurée par MorphMenu.
export function LessonBreadcrumb({
  formation,
  currentModuleSlug,
  currentCourseSlug,
  courseName,
  tree,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Fermeture du morph exposée par render-prop, stockée en ref pour navigate().
  const closeRef = useRef<() => void>(() => {});

  const currentModule = tree.find((m) => m.slug === currentModuleSlug);
  const currentCourse = currentModule?.courses.find((c) => c.slug === currentCourseSlug);
  const triggerLabel = currentModule?.name ?? formation.name;

  // Navigation depuis le menu. Pour un cours : voile de transition (skeleton →
  // révélation). startTransition court-circuite le loading.tsx « dashboard ».
  function navigate(href: string, isLesson: boolean) {
    closeRef.current();
    if (isLesson) {
      startLessonTransition();
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    startTransition(() => router.push(href));
  }

  return (
    <MorphMenu
      origin="top-left"
      openWidth={320}
      zIndex={50}
      closedRadius={10}
      ariaLabel={`Parcourir la formation, leçon ${courseName}`}
      triggerFbLabel="Déclencheur fil d'ariane · Fil d'ariane leçon"
      panelFbLabel="Menu navigation formation · Fil d'ariane leçon"
      anchorStyle={{ maxWidth: "100%" }}
      triggerClassName="bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)]"
      triggerStyle={{
        gap: 8,
        maxWidth: 260,
        padding: "6px 10px",
        borderRadius: 10,
        border: "1px solid var(--color-border-default)",
        fontSize: 13,
      }}
      triggerContent={(open) => (
        <>
          <ListTree size={15} style={{ flexShrink: 0, color: "var(--color-brand)" }} />
          <span
            style={{
              color: "var(--color-text-primary)",
              fontWeight: 600,
              maxWidth: 170,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {triggerLabel}
          </span>
          <ChevronDown
            size={14}
            style={{
              flexShrink: 0,
              color: "var(--color-text-muted)",
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 180ms var(--nc-ease)",
            }}
          />
        </>
      )}
    >
      <div style={{ width: "100%", padding: 8 }}>
        {/* Vue d'ensemble du programme */}
        <button
          type="button"
          onClick={() => navigate(`/formation/${formation.slug}`, false)}
          data-fb-label="Lien Vue d'ensemble du programme · Fil d'ariane leçon"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "8px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
          className="bg-transparent transition-colors hover:bg-[var(--color-surface-raised)]"
        >
          <GraduationCap size={16} style={{ color: "var(--color-brand)", flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {formation.name}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
              Vue d&apos;ensemble du programme
            </span>
          </span>
        </button>

        <div style={{ height: 1, background: "var(--color-border-default)", margin: "6px 4px" }} />

        <Tree
          initialSelectedId={currentCourse?.id}
          initialExpandedItems={currentModule ? [currentModule.id] : []}
          style={{ maxHeight: 320 }}
        >
          {tree.map((m) => (
            <Folder key={m.id} value={m.id} element={m.name}>
              {m.courses.map((c) => (
                <File
                  key={c.id}
                  value={c.id}
                  isSelectable={!c.locked}
                  isSelect={c.slug === currentCourseSlug}
                  fileIcon={
                    c.locked ? (
                      <Lock size={15} className="opacity-60" />
                    ) : c.completed ? (
                      <CheckCircle2 size={15} style={{ color: "var(--color-brand)" }} />
                    ) : (
                      <PlayCircle size={15} className="opacity-70" />
                    )
                  }
                  onClick={() => {
                    if (!c.locked) navigate(`/formation/${formation.slug}/${m.slug}/${c.slug}`, true);
                  }}
                >
                  {c.name}
                </File>
              ))}
            </Folder>
          ))}
        </Tree>
      </div>
    </MorphMenu>
  );
}

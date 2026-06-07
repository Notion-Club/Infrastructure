"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  ListTree,
  Lock,
  PlayCircle,
} from "lucide-react";

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

// Fil d'Ariane des leçons : un déclencheur (icône + module courant) qui ouvre
// un file-tree (modules → cours) de toute la formation pour naviguer librement.
// Dropdown en flux (scrolle avec la page) + fade-in.
export function LessonBreadcrumb({
  formation,
  currentModuleSlug,
  currentCourseSlug,
  courseName,
  tree,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentModule = tree.find((m) => m.slug === currentModuleSlug);
  const currentCourse = currentModule?.courses.find((c) => c.slug === currentCourseSlug);
  const triggerLabel = currentModule?.name ?? formation.name;

  const closeMenu = useCallback(() => {
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 150);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closeMenu();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenu();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  // Navigation depuis le menu. Pour un cours : voile de transition (skeleton →
  // révélation). startTransition court-circuite le loading.tsx « dashboard ».
  function navigate(href: string, isLesson: boolean) {
    setOpen(false);
    setClosing(false);
    if (isLesson) {
      startLessonTransition();
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    startTransition(() => router.push(href));
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
      <button
        type="button"
        aria-label={`Parcourir la formation — leçon ${courseName}`}
        aria-expanded={open}
        onClick={() => (open && !closing ? closeMenu() : (setClosing(false), setOpen(true)))}
        data-fb-label="Déclencheur fil d'ariane · Fil d'ariane leçon"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          maxWidth: "100%",
          padding: "6px 10px",
          borderRadius: 10,
          border: "1px solid var(--color-border-default)",
          fontSize: 13,
          cursor: "pointer",
        }}
        className="bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)]"
      >
        <ListTree size={15} style={{ flexShrink: 0, color: "var(--color-brand)" }} />
        <span
          style={{
            color: "var(--color-text-primary)",
            fontWeight: 600,
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
      </button>

      {open && (
        <div
          className="nc-dropdown"
          data-closing={closing}
          data-fb-label="Menu navigation formation · Fil d'ariane leçon"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 16,
            boxShadow: "var(--nc-shadow-3)",
            padding: 8,
          }}
        >
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
      )}
    </div>
  );
}

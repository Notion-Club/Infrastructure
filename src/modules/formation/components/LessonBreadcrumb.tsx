"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import {
  CheckCircle2,
  ChevronsUpDown,
  GraduationCap,
  Lock,
  PlayCircle,
} from "lucide-react";

import { Tree, Folder, File } from "@/shared/components/ui/file-tree";
import type { LessonTreeModule } from "../types";

type Props = {
  formation: { slug: string; name: string };
  currentModuleSlug: string;
  currentCourseSlug: string;
  courseName: string;
  tree: LessonTreeModule[];
};

// Fil d'Ariane des leçons : un déclencheur « [… nom de page] » qui ouvre un
// file-tree (modules → cours) de toute la formation pour naviguer librement.
export function LessonBreadcrumb({
  formation,
  currentModuleSlug,
  currentCourseSlug,
  courseName,
  tree,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const currentModule = tree.find((m) => m.slug === currentModuleSlug);
  const currentCourse = currentModule?.courses.find((c) => c.slug === currentCourseSlug);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Parcourir la formation"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            maxWidth: "100%",
            padding: "6px 10px",
            borderRadius: 10,
            border: "1px solid var(--color-border-default)",
            background: "var(--color-surface-card)",
            fontSize: 13,
            cursor: "pointer",
            color: "var(--color-text-secondary)",
          }}
          className="hover:bg-[var(--color-surface-raised)] transition-colors"
        >
          <span aria-hidden style={{ color: "var(--color-text-muted)", letterSpacing: 1 }}>
            …
          </span>
          <span
            style={{
              color: "var(--color-text-primary)",
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {courseName}
          </span>
          <ChevronsUpDown size={13} style={{ flexShrink: 0, color: "var(--color-text-muted)" }} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          style={{
            zIndex: 1000,
            width: 320,
            maxWidth: "calc(100vw - 24px)",
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
            onClick={() => go(`/formation/${formation.slug}`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 8px",
              borderRadius: 10,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
            className="hover:bg-[var(--color-surface-raised)] transition-colors"
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

          <div
            style={{
              height: 1,
              background: "var(--color-border-default)",
              margin: "6px 4px",
            }}
          />

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
                      if (!c.locked) go(`/formation/${formation.slug}/${m.slug}/${c.slug}`);
                    }}
                  >
                    {c.name}
                  </File>
                ))}
              </Folder>
            ))}
          </Tree>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

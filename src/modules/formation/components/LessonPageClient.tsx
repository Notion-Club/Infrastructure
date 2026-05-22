"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Lock, Phone } from "lucide-react";

import { useFormationContext } from "../hooks/useFormationMocks";
import { findLessonByPath } from "../mocks/formation.mock";
import {
  canAccessLesson,
  shouldForceLock,
  shouldForceDeletedResources,
} from "../lib/canAccessLesson";

import { TellaPlayer } from "./TellaPlayer";
import { ResourceCard } from "./ResourceCard";
import { LessonNotes } from "./LessonNotes";
import { LessonNavigation } from "./LessonNavigation";
import { SalesLessonCTA } from "./SalesLessonCTA";

type Props = {
  programSlug: string;
  moduleSlug: string;
  lessonSlug: string;
};

export function LessonPageClient({
  programSlug,
  moduleSlug,
  lessonSlug,
}: Props) {
  const router = useRouter();
  const { capabilities, progress, devSpecial, markCompleted, setLastAccessed } =
    useFormationContext();

  const found = useMemo(
    () => findLessonByPath(programSlug, moduleSlug, lessonSlug),
    [programSlug, moduleSlug, lessonSlug],
  );

  // Garde d'accès — capability + drip strict. Si KO : redirect + toast.
  // C'est l'équivalent de ce qu'un middleware Supabase ferait côté serveur.
  useEffect(() => {
    if (!found) return;
    const { program, module, lesson } = found;
    const access = canAccessLesson({
      program,
      module,
      lesson,
      capabilities,
      progress,
      forceLocked: shouldForceLock(devSpecial),
    });
    if (access.allowed) {
      setLastAccessed(lesson.id);
      return;
    }
    if (access.reason === "no_capability") {
      toast.error(
        "Cette leçon est réservée aux membres de Devenir consultant Notion",
      );
      router.replace("/formation");
    } else if (access.reason === "drip_locked") {
      toast("Termine la leçon précédente pour débloquer", {
        icon: <Lock size={14} />,
      });
      router.replace(`/formation/${program.slug}`);
    }
  }, [found, capabilities, progress, devSpecial, router, setLastAccessed]);

  const forceDeleted = shouldForceDeletedResources(devSpecial);

  // Filtre des ressources : on retire celles avec cachedUrl null. Si le
  // toggle `resource_deleted` est actif, on force la dernière ressource
  // à null pour vérifier visuellement la règle de masquage. Hook hissé
  // au-dessus du early return pour respecter les rules-of-hooks.
  const visibleResources = useMemo(() => {
    if (!found) return [];
    let pool = found.lesson.resources;
    if (forceDeleted && pool.length > 0) {
      pool = pool.map((r, i) =>
        i === pool.length - 1 ? { ...r, cachedUrl: null } : r,
      );
    }
    return pool.filter((r) => r.cachedUrl !== null);
  }, [found, forceDeleted]);

  if (!found) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <p style={{ fontSize: 16, color: "var(--color-text-secondary)" }}>
          Leçon introuvable.
        </p>
      </div>
    );
  }

  const { program, module, lesson } = found;

  const isSales = lesson.isSalesLesson;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Breadcrumb */}
      <nav
        aria-label="Fil d'ariane"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
          fontSize: 12,
          color: "var(--color-text-muted)",
        }}
      >
        <Link
          href="/formation"
          style={{ color: "inherit", textDecoration: "none" }}
          className="hover:text-[var(--color-text-secondary)]"
        >
          Formation
        </Link>
        <ChevronRight size={11} />
        <Link
          href={`/formation/${program.slug}`}
          style={{ color: "inherit", textDecoration: "none" }}
          className="hover:text-[var(--color-text-secondary)]"
        >
          {program.name}
        </Link>
        <ChevronRight size={11} />
        <span>{module.name}</span>
        <ChevronRight size={11} />
        <span style={{ color: "var(--color-text-primary)" }}>{lesson.title}</span>
      </nav>

      {/* Layout 2 colonnes desktop / stack mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Colonne principale */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {lesson.videoUrl && (
            <TellaPlayer
              videoUrl={lesson.videoUrl}
              durationSeconds={lesson.videoDurationSeconds}
              title={lesson.title}
            />
          )}

          {/* Titre */}
          <header
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {isSales && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--color-brand)",
                    background: "rgba(224,98,90,0.10)",
                    border: "1px solid rgba(224,98,90,0.25)",
                    borderRadius: 9999,
                    padding: "3px 10px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  <Phone size={11} />
                  Module de vente
                </span>
              )}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                }}
              >
                Leçon {lesson.position}
              </span>
            </div>
            <h1
              style={{
                fontSize: "clamp(28px, 3.6vw, 38px)",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "var(--color-text-primary)",
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              {lesson.title}
            </h1>
          </header>

          {/* Description */}
          <section
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--color-text-secondary)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <p style={{ margin: 0 }}>{lesson.description}</p>
            <p style={{ margin: 0 }}>
              Cette leçon te donne les fondations pour passer à la suite du
              programme. Prends le temps de noter ce que tu vas appliquer dès
              cette semaine — tu retrouveras tes notes ici à chaque retour.
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 22,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <li>Comprends les concepts présentés et leur ordre.</li>
              <li>
                Identifie ce qui s&apos;applique directement à ton workspace.
              </li>
              <li>Repère 1 action concrète à mettre en place cette semaine.</li>
            </ul>
          </section>

          {/* Ressources */}
          {visibleResources.length > 0 && (
            <section
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <h2
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Ressources de cette leçon
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {visibleResources.map((r) => (
                  <ResourceCard key={r.id} resource={r} />
                ))}
              </div>
            </section>
          )}

          {/* Bloc nav / sales CTA */}
          {isSales ? (
            <SalesLessonCTA
              lessonId={lesson.id}
              onClick={() => markCompleted(lesson.id)}
            />
          ) : (
            <LessonNavigation
              program={program}
              module={module}
              lesson={lesson}
            />
          )}
        </div>

        {/* Colonne latérale notes */}
        <aside className="md:col-span-1">
          <div style={{ position: "sticky", top: 130 }}>
            <LessonNotes key={lesson.id} lessonId={lesson.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}

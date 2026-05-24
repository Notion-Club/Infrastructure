"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, PartyPopper } from "lucide-react";

import { useFormationContext } from "../hooks/useFormationMocks";
import { getProgramStats } from "../lib/devOverrides";
import { ProgressBar } from "@/shared/components/dashboard/widgets/ProgressBar";
import { ModuleAccordion } from "./ModuleAccordion";
import { SectionDivider } from "./SectionDivider";

type Props = { programSlug: string };

export function ProgramPageClient({ programSlug }: Props) {
  const router = useRouter();
  const { getProgramBySlug, capabilities, progress } = useFormationContext();
  const program = getProgramBySlug(programSlug);

  // Garde d'accès — si l'user n'a pas la capability requise, on redirige
  // vers /formation avec un toast d'explication. La maquette ne dispose
  // pas de middleware Supabase ; cette logique est portée par useEffect.
  useEffect(() => {
    if (!program) return;
    if (!capabilities.includes(program.requiredCapability)) {
      const msg =
        program.requiredCapability === "can_access_paid_programs"
          ? "Ce programme est réservé aux membres de Devenir consultant Notion"
          : "Tu n'as pas accès à ce programme";
      toast.error(msg);
      router.replace("/formation");
    }
  }, [program, capabilities, router]);

  // Pré-ouvre l'accordéon contenant la prochaine leçon à faire pour que
  // l'user ne fasse pas un clic supplémentaire.
  const defaultOpenModuleId = useMemo(() => {
    if (!program) return null;
    const ordered = program.modules
      .slice()
      .sort((a, b) => a.position - b.position);
    for (const mod of ordered) {
      const hasUncompleted = mod.lessons.some(
        (l) => !progress.completedLessonIds.includes(l.id),
      );
      if (hasUncompleted) return mod.id;
    }
    return ordered[0]?.id ?? null;
  }, [program, progress]);

  if (!program) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center" }}>
        <p
          style={{
            fontSize: 16,
            color: "var(--color-text-secondary)",
            marginBottom: 16,
          }}
        >
          Programme introuvable.
        </p>
        <button
          type="button"
          onClick={() => router.push("/formation")}
          style={{
            background: "var(--color-brand)",
            color: "white",
            border: "none",
            borderRadius: 9999,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <ArrowLeft size={14} />
          Retour à Formation
        </button>
      </div>
    );
  }

  const stats = getProgramStats(program, progress);
  const isComplete = stats.percent === 100;

  // Regroupement par section pour le programme paid.
  const architecteModules = program.modules
    .filter((m) => m.section === "architecte")
    .sort((a, b) => a.position - b.position);
  const businessModules = program.modules
    .filter((m) => m.section === "business")
    .sort((a, b) => a.position - b.position);
  const unsectionedModules = program.modules
    .filter((m) => m.section === null)
    .sort((a, b) => a.position - b.position);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <button
        type="button"
        onClick={() => router.push("/formation")}
        style={{
          alignSelf: "flex-start",
          background: "transparent",
          border: "none",
          color: "var(--color-text-muted)",
          fontSize: 13,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: 0,
        }}
        className="hover:text-[var(--color-text-secondary)]"
      >
        <ArrowLeft size={14} />
        Tous les programmes
      </button>

      <header
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <h1
          style={{
            fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 700,
            letterSpacing: "-0.025em",
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {program.name}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--color-text-secondary)",
            margin: 0,
            maxWidth: 720,
            lineHeight: 1.5,
          }}
        >
          {program.description}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
            maxWidth: 480,
          }}
        >
          <ProgressBar percent={stats.percent} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            <span>
              {stats.completedLessons} / {stats.totalLessons} leçons complétées
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--color-brand)",
              }}
            >
              {stats.percent}%
            </span>
          </div>
        </div>

        {isComplete && (
          <div
            style={{
              marginTop: 4,
              background:
                "linear-gradient(110deg, rgba(224,98,90,0.10), rgba(224,98,90,0.03))",
              border: "1px solid rgba(224,98,90,0.25)",
              borderRadius: 16,
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <PartyPopper
              size={22}
              style={{ color: "var(--color-brand)", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  margin: 0,
                }}
              >
                Félicitations, tu as terminé {program.name}.
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-text-secondary)",
                  margin: "2px 0 0 0",
                }}
              >
                Tu peux relire les modules à tout moment.
              </p>
            </div>
            <button
              type="button"
              disabled
              style={{
                background: "var(--color-surface-card)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 9999,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                opacity: 0.55,
                cursor: "not-allowed",
              }}
              title="Bientôt disponible"
            >
              <CheckCircle2 size={14} />
              Télécharger ton certificat (bientôt)
            </button>
          </div>
        )}
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {unsectionedModules.length > 0 &&
          unsectionedModules.map((mod) => (
            <ModuleAccordion
              key={mod.id}
              program={program}
              module={mod}
              defaultOpen={mod.id === defaultOpenModuleId}
            />
          ))}

        {architecteModules.length > 0 && (
          <>
            <SectionDivider label="Notion Architecte" />
            {architecteModules.map((mod) => (
              <ModuleAccordion
                key={mod.id}
                program={program}
                module={mod}
                defaultOpen={mod.id === defaultOpenModuleId}
              />
            ))}
          </>
        )}

        {businessModules.length > 0 && (
          <>
            <SectionDivider label="Notion Business" />
            {businessModules.map((mod) => (
              <ModuleAccordion
                key={mod.id}
                program={program}
                module={mod}
                defaultOpen={mod.id === defaultOpenModuleId}
              />
            ))}
          </>
        )}
      </section>
    </div>
  );
}

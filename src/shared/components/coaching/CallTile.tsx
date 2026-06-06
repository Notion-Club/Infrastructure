"use client";

// Tuile d'appel cliquable — remplace l'ancien accordéon `CallCard`.
//
//   • Variante « past »     : clic → ouvre `CallDetailModal` (plan d'actions
//                             + transcription + barre IA). Pas de pills statut.
//   • Variante « upcoming »  : non cliquable, pill date relative
//                             (Aujourd'hui / Demain / Dans X jours).
//
// Le nom + l'avatar du coach viennent de la donnée (`call.host` /
// `host_avatar_url`) — jamais hardcodés.

import { useState } from "react";
import type { CallCardData } from "@/shared/lib/mock/coaching";
import { CallDetailModal } from "@/shared/components/coaching/CallDetailModal";

// Couleurs de fallback des initiales quand Notion n'a pas de photo de profil.
const HOST_FALLBACK: Record<string, { initials: string; bg: string }> = {
  Théo: { initials: "TG", bg: "#e0625a" },
  Noah: { initials: "NL", bg: "#7c3aed" },
};

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return datePart.charAt(0).toUpperCase() + datePart.slice(1);
}

function getUpcomingLabel(iso: string): string {
  const diffDays = Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 0) return "Aujourd'hui";
  if (diffDays === 1) return "Demain";
  return `Dans ${diffDays} jours`;
}

interface CallTileProps {
  call: CallCardData;
  variant: "past" | "upcoming";
  archived?: boolean;
}

export function CallTile({ call, variant, archived = false }: CallTileProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isUpcoming = variant === "upcoming";
  const hasDetail = !!call.ai_summary || !!call.notion_page_id;
  const clickable = !isUpcoming && hasDetail;

  const fallback =
    HOST_FALLBACK[call.host] ?? {
      initials: call.host[0]?.toUpperCase() ?? "?",
      bg: "#6b7280",
    };

  function handleClick() {
    if (clickable) setDetailOpen(true);
  }

  return (
    <>
      <div
        data-fb-label="Tuile appel · Coaching"
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (clickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick();
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "var(--color-surface-card)",
          border: `1px solid ${
            hovered && clickable
              ? "rgba(224,98,90,0.28)"
              : "var(--color-border-default)"
          }`,
          borderRadius: 14,
          padding: "16px 18px",
          opacity: archived ? 0.78 : 1,
          cursor: clickable ? "pointer" : "default",
          transform: hovered && clickable ? "translateY(-2px)" : "translateY(0)",
          boxShadow:
            hovered && clickable
              ? "0 6px 24px rgba(224,98,90,0.10), 0 1px 3px rgba(0,0,0,0.04)"
              : "none",
          transition:
            "transform 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease), border-color 200ms var(--nc-ease)",
        }}
      >
        <h3
          data-fb-label="Titre · Tuile appel"
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {call.subject}
        </h3>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "var(--color-text-muted)",
              lineHeight: 1,
            }}
          >
            {formatDateLong(call.date)} avec
          </span>

          {/* Avatar coach — photo Notion si dispo, sinon initiales colorées */}
          <div
            data-fb-label="Avatar coach · Tuile appel"
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: fallback.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {call.host_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={call.host_avatar_url}
                alt={call.host}
                width={22}
                height={22}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "0.02em",
                  lineHeight: 1,
                }}
              >
                {fallback.initials}
              </span>
            )}
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              lineHeight: 1,
            }}
          >
            {call.host}
          </span>

          {/* Pill date relative — uniquement vue « à venir » */}
          {isUpcoming && (
            <span
              data-fb-label="Pill date relative · Tuile appel"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-brand)",
                background: "rgba(224,98,90,0.08)",
                borderRadius: 9999,
                padding: "2px 9px",
                flexShrink: 0,
              }}
            >
              {getUpcomingLabel(call.date)}
            </span>
          )}
        </div>
      </div>

      {/* Modale détail — montée seulement pour les tuiles passées avec contenu */}
      {clickable && (
        <CallDetailModal
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
          subject={call.subject}
          summary={call.ai_summary ?? ""}
          host={call.host}
          hostAvatarUrl={call.host_avatar_url ?? null}
          date={call.date}
          notionPageId={call.notion_page_id ?? null}
          transcriptUrl={call.transcript_url ?? null}
        />
      )}
    </>
  );
}

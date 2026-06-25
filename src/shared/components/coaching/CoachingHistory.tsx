"use client";

// Slot 2 — Historique des appels.
//
// Remplace les deux sections empilées (UpcomingCallsSection / PastCallsSection)
// par un switcher à pilule glissante (`CoachingTabs`) :
//   • Vue « Tes appels passés » (défaut) — appels passés AVEC contenu
//     (résumé OU transcription), triés par date décroissante. Exclut les
//     no-show sans contenu.
//   • Vue « Tes appels à venir » — appels aujourd'hui ou plus tard.
//
// Quand l'état n'a jamais d'appel à venir (formation finie, accompagnement
// expiré), on masque le switcher et on n'affiche que la grille des passés.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClockArrowReverseDotted,
  ClockBadgeCheckmark,
} from "@/shared/components/icons";
import type { CallCardData } from "@/shared/lib/mock/coaching";
import { CallTile } from "@/shared/components/coaching/CallTile";
import { CoachingTabs } from "@/shared/components/coaching/CoachingTabs";
import { UpcomingEmptyState } from "@/shared/components/coaching/UpcomingEmptyState";
import { AnimatedUpcomingGrid } from "@/shared/components/coaching/AnimatedUpcomingGrid";

type HistoryView = "past" | "upcoming";

interface CoachingHistoryProps {
  pastCalls: CallCardData[];
  upcomingCalls: CallCardData[];
  // Propose la vue « à venir ». Faux → grille des passés seule, sans switcher.
  showUpcoming: boolean;
  // Atténue les tuiles (accompagnement expiré).
  archived?: boolean;
  // L'utilisateur peut-il réserver ? Pilote la description de l'état vide
  // « à venir ».
  eligible?: boolean;
  // Incrémenté après une réservation confirmée → bascule sur l'onglet « à
  // venir » pour voir la nouvelle carte apparaître.
  focusUpcomingNonce?: number;
  // Vrai pendant la fenêtre de synchro Fillout → Notion après une réservation :
  // affiche un skeleton shimmer à la place de l'état vide « à venir ».
  bookingPending?: boolean;
  // Ouvre le pop-up Fillout de replanification / annulation d'un appel.
  onReschedule?: (url: string) => void;
}

function sectionLabel(text: string) {
  return (
    <h2
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: "var(--color-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        margin: "0 0 12px",
      }}
    >
      {text}
    </h2>
  );
}

// Skeletons shimmer affichés pendant la synchro d'une réservation, pour
// illustrer le chargement du nouvel appel.
function LoadingCallTiles() {
  const bar = (w: string, h: number, delay: number) => ({
    height: h,
    width: w,
    borderRadius: 6,
    background: "var(--color-border-default)",
    animation: "nc-skeleton-pulse 1.4s ease-in-out infinite",
    animationDelay: `${delay}ms`,
  });
  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      data-fb-label="Chargement appel à venir · Coaching"
      aria-label="Chargement du rendez-vous"
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            background: "var(--nc-tile-bg)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 14,
            padding: "16px 18px",
          }}
        >
          <div style={bar("65%", 13, i * 140)} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--color-border-default)",
                animation: "nc-skeleton-pulse 1.4s ease-in-out infinite",
                animationDelay: `${i * 140 + 80}ms`,
                flexShrink: 0,
              }}
            />
            <div style={bar("42%", 11, i * 140 + 160)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PastGrid({
  calls,
  archived,
}: {
  calls: CallCardData[];
  archived: boolean;
}) {
  if (calls.length === 0) {
    return (
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-muted)",
          margin: 0,
          padding: "12px 0",
        }}
      >
        Aucun résumé d&apos;appel pour le moment.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-fb-label="Grille appels passés · Coaching">
      {calls.map((call) => (
        <CallTile key={call.id} call={call} variant="past" archived={archived} />
      ))}
    </div>
  );
}

export function CoachingHistory({
  pastCalls,
  upcomingCalls,
  showUpcoming,
  archived = false,
  eligible = false,
  focusUpcomingNonce = 0,
  bookingPending = false,
  onReschedule,
}: CoachingHistoryProps) {
  // Démarre sur « à venir » si on arrive juste après une réservation (le
  // composant peut être monté à ce moment-là, ex. 1er appel jamais réservé).
  const [view, setView] = useState<HistoryView>(
    focusUpcomingNonce > 0 ? "upcoming" : "past",
  );

  // Bascule sur « à venir » quand une réservation est confirmée alors que le
  // composant est déjà monté (setState déféré pour éviter le lint).
  const prevFocus = useRef(focusUpcomingNonce);
  useEffect(() => {
    if (focusUpcomingNonce === prevFocus.current) return;
    prevFocus.current = focusUpcomingNonce;
    if (!showUpcoming) return;
    const id = requestAnimationFrame(() => setView("upcoming"));
    return () => cancelAnimationFrame(id);
  }, [focusUpcomingNonce, showUpcoming]);

  // Passés AVEC contenu (résumé ou transcription), triés date décroissante.
  const contentPastCalls = useMemo(() => {
    return pastCalls
      .filter((c) => !!c.ai_summary || !!c.notion_page_id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pastCalls]);

  // Sans vue « à venir » : grille des passés seule.
  if (!showUpcoming) {
    return (
      <div data-fb-label="Historique appels · Coaching">
        {sectionLabel("Tes appels passés")}
        <PastGrid calls={contentPastCalls} archived={archived} />
      </div>
    );
  }

  return (
    <div data-fb-label="Historique appels · Coaching">
      <div style={{ marginBottom: 16 }}>
        <CoachingTabs<HistoryView>
          ariaLabel="Vues de l'historique des appels"
          active={view}
          onChange={setView}
          tabs={[
            {
              value: "past",
              label: "Tes appels passés",
              icon: <ClockArrowReverseDotted size={15} />,
            },
            {
              value: "upcoming",
              label: "Tes appels à venir",
              icon: <ClockBadgeCheckmark size={15} />,
            },
          ]}
        />
      </div>

      {view === "past" ? (
        <PastGrid calls={contentPastCalls} archived={archived} />
      ) : upcomingCalls.length === 0 ? (
        // Réservation en cours de synchro → skeleton shimmer au lieu de l'état
        // vide « aucun appel », le temps que le nouvel appel arrive.
        bookingPending ? (
          <LoadingCallTiles />
        ) : (
          <UpcomingEmptyState eligible={eligible} />
        )
      ) : (
        <AnimatedUpcomingGrid
          calls={upcomingCalls}
          onReschedule={onReschedule}
        />
      )}
    </div>
  );
}

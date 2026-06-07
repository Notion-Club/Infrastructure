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

import { useMemo, useState } from "react";
import { History, CalendarClock } from "lucide-react";
import type { CallCardData } from "@/shared/lib/mock/coaching";
import { CallTile } from "@/shared/components/coaching/CallTile";
import { CoachingTabs } from "@/shared/components/coaching/CoachingTabs";

type HistoryView = "past" | "upcoming";

interface CoachingHistoryProps {
  pastCalls: CallCardData[];
  upcomingCalls: CallCardData[];
  // Propose la vue « à venir ». Faux → grille des passés seule, sans switcher.
  showUpcoming: boolean;
  // Atténue les tuiles (accompagnement expiré).
  archived?: boolean;
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
}: CoachingHistoryProps) {
  const [view, setView] = useState<HistoryView>("past");

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
              icon: <History size={15} />,
            },
            {
              value: "upcoming",
              label: "Tes appels à venir",
              icon: <CalendarClock size={15} />,
            },
          ]}
        />
      </div>

      {view === "past" ? (
        <PastGrid calls={contentPastCalls} archived={archived} />
      ) : upcomingCalls.length === 0 ? (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-muted)",
            margin: 0,
            padding: "12px 0",
            lineHeight: 1.55,
          }}
        >
          Aucun appel prévu pour le moment.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-fb-label="Grille appels à venir · Coaching">
          {upcomingCalls.map((call) => (
            <CallTile key={call.id} call={call} variant="upcoming" />
          ))}
        </div>
      )}
    </div>
  );
}

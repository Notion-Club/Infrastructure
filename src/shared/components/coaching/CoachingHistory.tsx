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
//
// Disposition : le switcher (ou le label de section) reste FIXE en tête ;
// seuls les items défilent en dessous, dans une zone scrollable bordée de
// voiles de flou haut/bas (même pattern que les onglets Plan d'actions /
// Transcription de la modale détail). L'état vide « à venir » et le skeleton
// de synchro ne scrollent pas : ils remplissent la hauteur dispo et sont
// clippés pour ne jamais dépasser l'encadré.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { History } from "lucide-react";
import { ClockArrowRight } from "@/shared/components/icons/ClockArrowRight";
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

// Corps scrollable + voiles de flou haut/bas, scroll-aware (repris du pattern
// des onglets Plan d'actions / Transcription de CallDetailModal). Les voiles ne
// s'affichent que lorsqu'il reste du contenu masqué de ce côté ; ils estompent
// les items qui entrent et sortent de la zone de défilement.
function ScrollArea({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop > 6;
      const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 6;
      setEdges((prev) =>
        prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
      );
    };
    // Double rAF : mesure APRÈS la pose du contenu (sinon scrollHeight stale au
    // 1er affichage → voiles inactifs jusqu'à un scroll).
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(update);
    });
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div ref={scrollRef} style={{ overflowY: "auto", flex: 1 }}>
        {children}
      </div>

      {/* Voile haut — visible quand du contenu déborde au-dessus. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 36,
          zIndex: 4,
          pointerEvents: "none",
          opacity: edges.top ? 1 : 0,
          transition: "opacity 260ms var(--nc-ease)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          maskImage:
            "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.55) 50%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0%, rgba(0,0,0,0.55) 50%, transparent 100%)",
        }}
      />

      {/* Voile bas — visible quand du contenu déborde en dessous. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 36,
          zIndex: 4,
          pointerEvents: "none",
          opacity: edges.bottom ? 1 : 0,
          transition: "opacity 260ms var(--nc-ease)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          maskImage:
            "linear-gradient(to top, black 0%, rgba(0,0,0,0.55) 50%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to top, black 0%, rgba(0,0,0,0.55) 50%, transparent 100%)",
        }}
      />
    </div>
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

  // Sans vue « à venir » : label de section fixe + grille des passés scrollable.
  if (!showUpcoming) {
    return (
      <div
        className="flex flex-col flex-1 min-h-0"
        data-fb-label="Historique appels · Coaching"
      >
        <div style={{ flexShrink: 0 }}>{sectionLabel("Tes appels passés")}</div>
        <ScrollArea>
          <PastGrid calls={contentPastCalls} archived={archived} />
        </ScrollArea>
      </div>
    );
  }

  const showEmptyOrLoading = view === "upcoming" && upcomingCalls.length === 0;

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      data-fb-label="Historique appels · Coaching"
    >
      {/* Switcher FIXE — ne défile jamais avec les items. */}
      <div style={{ flexShrink: 0, marginBottom: 16 }}>
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
              icon: <ClockArrowRight size={15} />,
            },
          ]}
        />
      </div>

      {showEmptyOrLoading ? (
        // NON scrollable : remplit la hauteur dispo et clippe le contenu (le
        // preview skeleton ne dépasse jamais l'encadré).
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {bookingPending ? (
            <LoadingCallTiles />
          ) : (
            <UpcomingEmptyState eligible={eligible} />
          )}
        </div>
      ) : (
        // Liste scrollable sous le switcher fixe, bordée de voiles de flou.
        // `key={view}` → re-mesure des voiles à chaque changement d'onglet.
        <ScrollArea key={view}>
          {view === "past" ? (
            <PastGrid calls={contentPastCalls} archived={archived} />
          ) : (
            <AnimatedUpcomingGrid
              calls={upcomingCalls}
              onReschedule={onReschedule}
            />
          )}
        </ScrollArea>
      )}
    </div>
  );
}

// État « Aucun appel à venir » — repris du design du chargement de
// transcription : titre centré + (si éligible) description incitative, puis
// transition fade-in flou vers des cartes d'appel en skeleton (fondues par le
// haut).
//
// Réutilisé tel quel dans les contextes Free et Formation (0 call) où la liste
// d'appels est par définition vide.

const SKELETON_CARDS = [0, 1];

interface UpcomingEmptyStateProps {
  // La description « Réserve ton appel pour avancer » n'est affichée que si
  // l'utilisateur peut réellement réserver (CTA de réservation actif).
  eligible: boolean;
}

export function UpcomingEmptyState({ eligible }: UpcomingEmptyStateProps) {
  return (
    <div data-fb-label="Aucun appel à venir · Coaching">
      {/* Titre + description centrés (gros titre focal, comme le chargement
          de transcription) */}
      <div style={{ textAlign: "center", padding: "16px 8px 0" }}>
        <h3
          style={{
            fontSize: "clamp(20px, 4vw, 26px)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.3,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          Aucun appel n&apos;est prévu
        </h3>
        {eligible && (
          <p
            style={{
              fontSize: 15,
              color: "var(--color-text-secondary)",
              margin: "10px 0 0",
              lineHeight: 1.5,
            }}
          >
            Réserve ton appel pour avancer
          </p>
        )}
      </div>

      {/* Transition fade-in flou vers les cartes skeleton, fondues par le haut */}
      <div
        className="nc-blur-in"
        aria-hidden
        style={{
          marginTop: 24,
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0, #000 64px)",
          maskImage: "linear-gradient(to bottom, transparent 0, #000 64px)",
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {SKELETON_CARDS.map((i) => (
            <SkeletonCallCard key={i} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SkeletonCallCard({ index }: { index: number }) {
  const base = index * 120;
  const bar = (w: string, h: number, delay: number) => ({
    height: h,
    width: w,
    borderRadius: 6,
    background: "var(--color-surface-raised)",
    animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
    animationDelay: `${delay}ms`,
  });
  return (
    <div
      style={{
        background: "var(--nc-tile-bg)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 14,
        padding: "16px 18px",
      }}
    >
      {/* Sujet */}
      <div style={bar("70%", 13, base)} />
      {/* Date + avatar coach */}
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
            background: "var(--color-surface-raised)",
            animation: "nc-skeleton-pulse 1.6s ease-in-out infinite",
            animationDelay: `${base + 80}ms`,
            flexShrink: 0,
          }}
        />
        <div style={bar("42%", 11, base + 120)} />
      </div>
    </div>
  );
}

// État « Aucun appel à venir » — repris du design du chargement de
// transcription : titre centré + (si éligible) description incitative, puis
// transition fade-in flou vers des cartes d'appel en skeleton (fondues par le
// haut).
//
// Réutilisé tel quel dans les contextes Free et Formation (0 call) où la liste
// d'appels est par définition vide.

// 2 rangées (4 cartes en grille 2 colonnes) : la 1re rangée est coupée par le
// fondu du haut, la 2de est entière.
const SKELETON_CARDS = [0, 1, 2, 3];

interface UpcomingEmptyStateProps {
  // La description « Réserve ton appel pour avancer » n'est affichée que si
  // l'utilisateur peut réellement réserver (CTA de réservation actif).
  eligible: boolean;
}

export function UpcomingEmptyState({ eligible }: UpcomingEmptyStateProps) {
  return (
    <div className="nc-mode-in" data-fb-label="Aucun appel à venir · Coaching">
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
            "linear-gradient(to bottom, transparent 0, #000 46px)",
          maskImage: "linear-gradient(to bottom, transparent 0, #000 46px)",
        }}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {SKELETON_CARDS.map((i) => (
            <SkeletonCallCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Carte d'appel en skeleton — STATIQUE (pas de pulse : c'est un aperçu, pas un
// chargement). Affiche une ligne entière + une ligne demie (date + coach).
function SkeletonCallCard() {
  // border-default contraste sur le fond de tuile (= fond de page) dans les
  // deux thèmes — surface-raised se confondait avec la tuile en light.
  const barBg = "var(--color-border-default)";
  return (
    <div
      style={{
        background: "var(--nc-tile-bg)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 14,
        padding: "16px 18px",
      }}
    >
      {/* Ligne entière */}
      <div
        style={{ height: 13, width: "100%", borderRadius: 6, background: barBg }}
      />
      {/* Ligne demie + avatar coach */}
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
            background: barBg,
            flexShrink: 0,
          }}
        />
        <div
          style={{ height: 11, width: "50%", borderRadius: 6, background: barBg }}
        />
      </div>
    </div>
  );
}

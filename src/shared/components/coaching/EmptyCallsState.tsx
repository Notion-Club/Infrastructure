// Slot 2 — état vide (aucun appel passé ni à venir).
//
// Mock floutés STATIQUES (cartes fantômes de transcriptions, pas de shimmer
// de loading) + eyes emoji animé + incitation. Entrée en fondu (`nc-mode-in`)
// pour la transition douce demandée entre le titre de section et le bloc.

const EYES_URL =
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/e2eb0709f7ba004d73ce96e041865c95deeaf80a/People/Eyes.webp";

const GHOST_CARDS = [
  { w: "68%" },
  { w: "54%" },
  { w: "62%" },
  { w: "48%" },
];

export function EmptyCallsState() {
  return (
    <div
      data-fb-label="Encadré aucun appel · Coaching"
      className="nc-mode-in"
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--color-border-default)",
        background: "var(--color-surface-card)",
        minHeight: 300,
      }}
    >
      {/* Cartes fantômes floutées statiques — grille 2 colonnes */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          padding: 20,
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 12,
          filter: "blur(3px)",
          opacity: 0.4,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {GHOST_CARDS.map((card, i) => (
          <div
            key={i}
            style={{
              background: "var(--color-surface-raised)",
              borderRadius: 12,
              padding: "16px 18px",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <div
              style={{
                height: 13,
                width: card.w,
                background: "#d1d5db",
                borderRadius: 6,
                marginBottom: 10,
              }}
            />
            <div
              style={{
                height: 10,
                width: "44%",
                background: "var(--color-border-default)",
                borderRadius: 6,
                marginBottom: 6,
              }}
            />
            <div
              style={{
                height: 10,
                width: "30%",
                background: "var(--color-border-default)",
                borderRadius: 6,
              }}
            />
          </div>
        ))}
      </div>

      {/* Couche d'incitation centrée */}
      <div
        style={{
          position: "relative",
          minHeight: 300,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "40px 24px",
          background:
            "radial-gradient(120% 80% at 50% 50%, var(--color-surface-card) 35%, transparent 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={EYES_URL}
          alt=""
          width={88}
          height={88}
          style={{ display: "block", margin: "0 auto 18px" }}
        />
        <p
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          On s&apos;est jamais appelé,
          <br />
          ça serait peut-être l&apos;occasion ?
        </p>
      </div>
    </div>
  );
}

import { Lock } from "lucide-react";

export function FreeTeaserPanel() {
  return (
    <div
      data-fb-label="Encadré teaser coaching · CTA coaching"
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-border-default)",
        minHeight: 320,
      }}
    >
      {/* Background blurred mock cards */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          filter: "blur(3px)",
          opacity: 0.45,
          pointerEvents: "none",
          userSelect: "none",
        }}
        aria-hidden
      >
        {[
          { w: "70%", label: "Jeudi 15 mai 2026, 14h00" },
          { w: "55%", label: "Mardi 8 mai 2026, 10h00" },
          { w: "65%", label: "Jeudi 1 mai 2026, 14h00" },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              background: "var(--color-surface-raised)",
              borderRadius: 12,
              padding: "16px 20px",
              border: "1px solid var(--color-border-default)",
            }}
          >
            <div
              style={{
                height: 13,
                width: item.w,
                background: "#d1d5db",
                borderRadius: 6,
                marginBottom: 8,
              }}
            />
            <div
              style={{
                height: 10,
                width: "40%",
                background: "var(--color-border-default)",
                borderRadius: 6,
                marginBottom: 12,
              }}
            />
            <div
              style={{
                height: 10,
                width: "90%",
                background: "var(--color-border-default)",
                borderRadius: 6,
                marginBottom: 6,
              }}
            />
            <div
              style={{
                height: 10,
                width: "75%",
                background: "var(--color-border-default)",
                borderRadius: 6,
              }}
            />
          </div>
        ))}
      </div>

      {/* Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--nc-lock-overlay-bg)",
          backdropFilter: "blur(2px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(224, 98, 90, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <Lock size={24} style={{ color: "var(--color-brand)" }} />
        </div>

        <h3
          data-fb-label="Titre · Encadré teaser coaching"
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--color-text-primary)",
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}
        >
          Coaching individuel
        </h3>

        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-secondary)",
            lineHeight: 1.6,
            margin: "0 0 20px",
            maxWidth: 340,
          }}
        >
          Avec l&apos;Accompagnement, tu peux réserver jusqu&apos;à 3 coachings
          par semaine avec Théo ou Noah pour avancer plus vite sur ton projet
          Notion.
        </p>

        <a
          href="#"
          data-fb-label="Lien Découvrir l'Accompagnement · Encadré teaser coaching"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-brand)",
            textDecoration: "none",
          }}
        >
          Découvrir l&apos;Accompagnement →
        </a>
      </div>
    </div>
  );
}

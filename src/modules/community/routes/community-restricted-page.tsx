import Link from "next/link";
import { Lock } from "lucide-react";

export function CommunityRestrictedPage() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--color-surface-card)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 24,
          padding: "48px 40px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          boxShadow: "var(--nc-shadow-2)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(224,98,90,0.10)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Lock size={28} style={{ color: "var(--color-brand)" }} />
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "var(--color-text-primary)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          La Communauté est réservée aux membres Accompagnement
        </h1>

        <p
          style={{
            fontSize: 15,
            color: "var(--color-text-secondary)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Rejoins la communauté pour échanger avec d&apos;autres passionnés Notion et bénéficier des conseils des mentors.
        </p>

        <Link
          href="#upgrade"
          className="nc-btn-shine"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            padding: "12px 28px",
            background: "var(--color-brand)",
            color: "#fff",
            border: "none",
            borderRadius: 9999,
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
            transition: "opacity 150ms ease",
          }}
        >
          Découvrir Accompagnement →
        </Link>
      </div>
    </div>
  );
}

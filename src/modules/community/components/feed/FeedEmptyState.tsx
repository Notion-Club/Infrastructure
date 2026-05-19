export function FeedEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        textAlign: "center",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 40 }}>🌱</div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--color-text-primary)",
          margin: 0,
        }}
      >
        Aucune publication pour le moment
      </h3>
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0, maxWidth: 300 }}>
        Sois le premier à partager quelque chose avec la communauté !
      </p>
    </div>
  );
}

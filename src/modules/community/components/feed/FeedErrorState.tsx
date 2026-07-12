interface FeedErrorStateProps {
  onRetry: () => void;
}

export function FeedErrorState({ onRetry }: FeedErrorStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px",
        textAlign: "center",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 40 }}>⚡</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
        Une erreur est survenue
      </h3>
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0 }}>
        Impossible de charger le feed pour le moment.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          padding: "10px 24px",
          background: "var(--color-text-primary)",
          color: "#fff",
          border: "none",
          borderRadius: 9999,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          transition: "opacity var(--nc-duration-xfast) var(--nc-ease)",
        }}
        className="hover:opacity-80"
      >
        Réessayer
      </button>
    </div>
  );
}

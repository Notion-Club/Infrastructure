export function MessagesEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
        padding: 40,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40 }}>💬</div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
        Aucune conversation
      </h3>
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0, maxWidth: 280 }}>
        Démarrez une nouvelle conversation en cliquant sur le bouton + ci-dessus.
      </p>
    </div>
  );
}

export function ConversationEmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
        padding: 40,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40 }}>👋</div>
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0 }}>
        Envoyez un premier message pour démarrer la conversation.
      </p>
    </div>
  );
}

import { PlusMessage } from "@/shared/components/icons";

export function MessagesEmptyState({
  onNewConversation,
}: {
  // Quand fourni, la phrase intègre le VRAI bouton « + » (cliquable, design
  // identique à celui de l'en-tête) directement dans la ligne, qui ouvre le
  // sélecteur de membres.
  onNewConversation?: () => void;
} = {}) {
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
      <p style={{ fontSize: 14, color: "var(--color-text-muted)", margin: 0, maxWidth: 300, lineHeight: 1.6 }}>
        {onNewConversation ? (
          <>
            Démarre une nouvelle conversation en cliquant sur{" "}
            <button
              type="button"
              onClick={onNewConversation}
              aria-label="Nouvelle conversation"
              data-fb-label="Bouton inline Nouvelle conversation · État vide messages"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "var(--color-brand)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
                verticalAlign: "middle",
                margin: "0 1px",
                transition: "opacity 150ms ease, transform 150ms ease",
              }}
              className="hover:opacity-85 hover:-translate-y-px"
            >
              <PlusMessage size={13} />
            </button>
          </>
        ) : (
          "Démarre une nouvelle conversation en cliquant sur le bouton + ci-dessus."
        )}
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

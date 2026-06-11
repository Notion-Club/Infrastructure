"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { toast } from "sonner";

import {
  sendAdminPushAction,
  type SendAdminPushInput,
} from "@/modules/admin/server/sendPushAction";

// Carte du DevToolbox réservée aux administrateurs : permet d'envoyer une
// notification Web Push à soi-même, à un utilisateur précis (UUID), ou à
// tous les abonnés actifs.
//
// La carte est compacte pour tenir dans la largeur du dropdown (320px) ;
// les inputs utilisent la classe partagée `.nc-input` (cf. globals.css).

type Target = SendAdminPushInput["target"]["type"];

const TARGETS: Array<{ key: Target; label: string }> = [
  { key: "self", label: "Moi" },
  { key: "user", label: "Membre" },
  { key: "all", label: "Tous" },
];

export function AdminPushDevCard() {
  const [target, setTarget] = useState<Target>("self");
  const [userId, setUserId] = useState("");
  const [title, setTitle] = useState("Test Notion Club");
  const [body, setBody] = useState("Coucou, ceci est un test de notif.");
  const [url, setUrl] = useState("/dashboard");
  const [pending, startTransition] = useTransition();

  function handleSend() {
    if (!title.trim()) {
      toast.error("Le titre est obligatoire.");
      return;
    }
    if (target === "user" && !isUuid(userId)) {
      toast.error("UUID utilisateur invalide.");
      return;
    }

    const payload: SendAdminPushInput =
      target === "user"
        ? {
            target: { type: "user", userId: userId.trim() },
            title: title.trim(),
            body: body.trim() || undefined,
            url: url.trim() || undefined,
          }
        : {
            target: { type: target },
            title: title.trim(),
            body: body.trim() || undefined,
            url: url.trim() || undefined,
          };

    startTransition(async () => {
      const result = await sendAdminPushAction(payload);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      // Succès : on agrège dans un message lisible.
      const recipientsLabel =
        result.recipients > 1
          ? `${result.recipients} membres`
          : "1 membre";
      toast.success(
        `Push envoyée à ${recipientsLabel} — ${result.sent} OK, ${result.expired} expiré, ${result.failed} échec.`,
      );
    });
  }

  return (
    <div data-fb-label="Outils admin · Notif push">
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-muted)",
          margin: "2px 6px 8px",
        }}
      >
        Notification push
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 4px" }}>
        {/* Cible */}
        <Field label="Cible">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {TARGETS.map((t) => {
              const active = t.key === target;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTarget(t.key)}
                  style={{
                    padding: "6px 8px",
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    color: active ? "#fff" : "var(--color-text-primary)",
                    background: active ? "var(--color-brand)" : "var(--color-surface-raised)",
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "background 150ms ease",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>

        {target === "user" && (
          <Field label="UUID utilisateur">
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-…"
              className="nc-input"
              style={inputStyle}
              spellCheck={false}
            />
          </Field>
        )}

        <Field label="Titre">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className="nc-input"
            style={inputStyle}
          />
        </Field>

        <Field label="Message">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
            rows={2}
            className="nc-input"
            style={{ ...inputStyle, resize: "vertical", minHeight: 52 }}
          />
        </Field>

        <Field label="URL (optionnel)">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/dashboard"
            className="nc-input"
            style={inputStyle}
            spellCheck={false}
          />
        </Field>

        <button
          type="button"
          onClick={handleSend}
          disabled={pending}
          style={{
            marginTop: 4,
            padding: "10px 12px",
            fontSize: 13.5,
            fontWeight: 600,
            color: "#fff",
            background: pending
              ? "color-mix(in srgb, var(--color-brand) 60%, transparent)"
              : "var(--color-brand)",
            border: "none",
            borderRadius: 10,
            cursor: pending ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "background 150ms ease",
          }}
        >
          {pending ? (
            <>
              <LoaderCircle size={14} className="animate-spin" />
              Envoi…
            </>
          ) : (
            <>
              <Send size={14} />
              Envoyer
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--color-text-secondary)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  fontSize: 13.5,
  borderRadius: 8,
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

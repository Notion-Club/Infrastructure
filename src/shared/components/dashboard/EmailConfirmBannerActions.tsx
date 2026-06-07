"use client";

import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { resendVerificationEmailAction } from "@/modules/auth";

const GMAIL_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777309478/Gmail_nabysh.png";
const GMAIL_SEARCH_URL =
  "https://mail.google.com/mail/u/0/#search/Notion+club";

// Sous-composant Client du EmailConfirmBanner. Contient :
//   - Raccourci Gmail (a) si l'user est éligible (param showGmail)
//   - Bouton "Renvoyer l'email" branché sur resendVerificationEmailAction
//     avec cooldown 60s côté UI (le serveur a son propre rate-limit identique).
export function EmailConfirmBannerActions({
  showGmail,
}: {
  showGmail: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const disabled = isPending || cooldownRemaining > 0;

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const id = setInterval(() => {
      setCooldownRemaining((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownRemaining]);

  function handleClick() {
    if (disabled) return;
    startTransition(async () => {
      const result = await resendVerificationEmailAction();
      if (result.ok) {
        toast.success("Email renvoyé. Vérifie ta boîte (et les spams).");
        setCooldownRemaining(60);
        return;
      }
      if (result.code === "rate_limited" && result.retryAfterSeconds) {
        setCooldownRemaining(result.retryAfterSeconds);
      }
      toast.error(result.message);
    });
  }

  const label =
    cooldownRemaining > 0
      ? `Renvoyer (${cooldownRemaining}s)`
      : isPending
        ? "Envoi…"
        : "Renvoyer l'email";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {showGmail && (
        <a
          href={GMAIL_SEARCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ouvrir Gmail"
          title="Ouvrir Gmail"
          data-fb-label="Bouton Ouvrir Gmail · Bannière Confirmation email"
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "var(--color-surface-card)",
            border: "1px solid var(--color-border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow:
              "0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            transition: "box-shadow 150ms ease, border-color 150ms ease",
            textDecoration: "none",
          }}
          className="hover:border-[rgba(0,0,0,0.15)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
        >
          <Image
            src={GMAIL_LOGO}
            alt="Gmail"
            width={20}
            height={20}
            style={{ display: "block" }}
          />
        </a>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        data-fb-label="Bouton Renvoyer l'email · Bannière Confirmation email"
        style={{
          height: 36,
          padding: "0 18px",
          borderRadius: 9999,
          fontSize: 13,
          fontWeight: 500,
          border: "1px solid var(--color-border-default)",
          background: disabled ? "var(--color-surface-raised)" : "white",
          color: disabled
            ? "var(--color-text-muted)"
            : "var(--color-text-primary)",
          cursor: disabled ? "not-allowed" : "pointer",
          transition:
            "background 150ms ease, color 150ms ease, border-color 150ms ease",
          boxShadow: disabled
            ? "none"
            : "0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          whiteSpace: "nowrap",
        }}
        className={disabled ? "" : "hover:border-[rgba(0,0,0,0.15)]"}
      >
        {label}
      </button>
    </div>
  );
}

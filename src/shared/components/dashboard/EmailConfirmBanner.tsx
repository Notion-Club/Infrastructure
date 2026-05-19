"use client";

import Image from "next/image";
import { Mail } from "lucide-react";
import { useState } from "react";

const GMAIL_LOGO =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777309478/Gmail_nabysh.png";
const GMAIL_SEARCH_URL =
  "https://mail.google.com/mail/u/0/#search/Notion+club";

const MOCK_EMAIL = "theo@gmail.com";

function isGmailUser(email: string) {
  const lower = email.toLowerCase();
  return !["yahoo", "outlook", "proton"].some((p) => lower.includes(p));
}

export function EmailConfirmBanner() {
  const [sent, setSent] = useState(false);
  const showGmail = isGmailUser(MOCK_EMAIL);

  return (
    <div className="nc-shine-card col-span-1 md:col-span-2">
      <div
        className="nc-shine-card__inner"
        style={{ padding: "20px 24px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "rgba(224,98,90,0.08)",
                border: "1px solid rgba(224,98,90,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Mail size={17} style={{ color: "var(--color-brand)" }} />
            </div>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                lineHeight: 1.3,
              }}
            >
              Confirme ton adresse email
            </span>
          </div>

          {/* Body */}
          <p
            style={{
              fontSize: 13,
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Tu as reçu un email pour valider ton compte.{" "}
            <span style={{ color: "var(--color-text-muted)" }}>
              Pas reçu ?
            </span>
          </p>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Gmail shortcut — uniquement si le domaine n'est pas Yahoo / Outlook / Proton */}
            {showGmail && (
              <a
                href={GMAIL_SEARCH_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ouvrir Gmail"
                title="Ouvrir Gmail"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "white",
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

            {/* Renvoyer */}
            <button
              type="button"
              onClick={() => setSent(true)}
              disabled={sent}
              style={{
                height: 36,
                padding: "0 18px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 500,
                border: "1px solid var(--color-border-default)",
                background: sent ? "var(--color-surface-raised)" : "white",
                color: sent
                  ? "var(--color-text-muted)"
                  : "var(--color-text-primary)",
                cursor: sent ? "default" : "pointer",
                transition:
                  "background 150ms ease, color 150ms ease, border-color 150ms ease",
                boxShadow: sent
                  ? "none"
                  : "0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
                whiteSpace: "nowrap",
              }}
              className={sent ? "" : "hover:border-[rgba(0,0,0,0.15)]"}
            >
              {sent ? "Email envoyé ✓" : "Renvoyer l'email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

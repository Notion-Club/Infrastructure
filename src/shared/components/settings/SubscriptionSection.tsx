"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { SettingsCard } from "./SettingsCard";

// Forme renvoyée par GET /api/payments/me. Un paiement = une ligne dans la
// base Notion `Paiements` (DB ID 2a1bad05-…) reliée à l'utilisateur via la
// relation `Membre` qui pointe vers sa page dans la DB Membres.
//
// `amountHt` (Montant HT Notion) est optionnel — disponible depuis la V2 du
// matching, certains paiements anciens ne l'ont pas en base.
type Payment = {
  notionId: string;
  label: string;
  amount: number | null;
  amountHt?: number | null;
  paymentDate: string | null;
  source: string | null;
  status: string | null;
  statusCategory: "paid" | "due" | "refused" | "unknown";
};

// Style des badges Statut — aligné sur les couleurs des options Notion
// ("Payé" vert, "À payer" bleu, "Refus" rouge).
const STATUS_STYLE: Record<
  Payment["statusCategory"],
  { bg: string; fg: string; border: string }
> = {
  paid: {
    bg: "rgba(39,174,142,0.10)",
    fg: "#16805f",
    border: "rgba(39,174,142,0.25)",
  },
  due: {
    bg: "rgba(91,141,239,0.10)",
    fg: "#2d5bb3",
    border: "rgba(91,141,239,0.25)",
  },
  refused: {
    bg: "rgba(224,98,90,0.10)",
    fg: "#b3433b",
    border: "rgba(224,98,90,0.25)",
  },
  unknown: {
    bg: "rgba(82,82,91,0.08)",
    fg: "#52525b",
    border: "rgba(82,82,91,0.20)",
  },
};

// Style des badges Source — Stripe en violet (couleur option Notion),
// virement bancaire en vert.
function sourceStyle(source: string | null): {
  bg: string;
  fg: string;
  border: string;
} {
  if (source === "Stripe") {
    return {
      bg: "rgba(138,108,242,0.10)",
      fg: "#6b4dd1",
      border: "rgba(138,108,242,0.25)",
    };
  }
  if (source === "Virement bancaire") {
    return {
      bg: "rgba(39,174,142,0.08)",
      fg: "#16805f",
      border: "rgba(39,174,142,0.22)",
    };
  }
  return {
    bg: "rgba(82,82,91,0.08)",
    fg: "#52525b",
    border: "rgba(82,82,91,0.20)",
  };
}

function formatEur(amount: number | null): string {
  if (amount === null) return "—";
  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function SubscriptionSection() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/payments/me", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) {
            // Pas d'utilisateur authentifié (mode démo) — on tait l'erreur,
            // l'écran affiche juste l'état "aucun paiement".
            if (!cancelled) setPayments([]);
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Erreur ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setPayments(data.payments ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les paiements.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // #85 — quand il n'y a aucun paiement, l'encadré passe en pointillés (état
  // vide) ; dès qu'il y a au moins une ligne, il garde sa bordure pleine.
  const isEmpty = !loading && !error && !!payments && payments.length === 0;

  return (
    <SettingsCard
      title="Paiements"
      description="Consultez l'historique de vos paiements en temps réel."
      fbLabel="Section abonnement · Réglages"
    >
      <div
        style={{
          border: `1px ${isEmpty ? "dashed" : "solid"} var(--color-border-default)`,
          borderRadius: 12,
          overflow: "hidden",
          background: isEmpty ? "transparent" : "var(--color-surface-card)",
        }}
      >
        {loading && (
          <div
            style={{
              padding: "28px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontSize: 13,
              color: "var(--color-text-muted)",
            }}
          >
            <LoaderCircle size={14} className="animate-spin" />
            Chargement des paiements…
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: "16px 14px",
              fontSize: 13,
              color: "#b3433b",
              background: "rgba(224,98,90,0.05)",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && payments && payments.length === 0 && (
          <div
            style={{
              padding: "28px 14px",
              fontSize: 13,
              color: "var(--color-text-muted)",
              textAlign: "center",
            }}
          >
            Aucun paiement enregistré pour le moment.
          </div>
        )}

        {!loading && payments && payments.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {payments.map((p, idx) => {
              const statusS = STATUS_STYLE[p.statusCategory];
              const sourceS = sourceStyle(p.source);
              return (
                <li
                  key={p.notionId}
                  data-fb-label="Ligne paiement · Section abonnement"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 14px",
                    borderBottom:
                      idx === payments.length - 1
                        ? "none"
                        : "1px solid var(--color-border-default)",
                  }}
                >
                  {/* Colonne gauche : date + label */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                      }}
                    >
                      {formatDate(p.paymentDate)}
                    </p>
                    {p.label && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: "var(--color-text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {p.label}
                      </p>
                    )}
                  </div>

                  {/* Badges Source + Statut */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexShrink: 0,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {p.source && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 9px",
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.02em",
                          color: sourceS.fg,
                          background: sourceS.bg,
                          border: `1px solid ${sourceS.border}`,
                        }}
                      >
                        {p.source}
                      </span>
                    )}
                    {p.status && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 9px",
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: "0.02em",
                          color: statusS.fg,
                          background: statusS.bg,
                          border: `1px solid ${statusS.border}`,
                        }}
                      >
                        {p.status}
                      </span>
                    )}
                  </div>

                  {/* Montant */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                      fontVariantNumeric: "tabular-nums",
                      flexShrink: 0,
                      minWidth: 90,
                      textAlign: "right",
                    }}
                  >
                    {formatEur(p.amount)}
                  </p>

                  {/* #132 — aucun lien vers Notion ici : Notion est le back-end
                      et ne doit jamais apparaître dans l'interface utilisateur. */}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SettingsCard>
  );
}

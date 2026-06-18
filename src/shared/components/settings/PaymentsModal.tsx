"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle, X } from "lucide-react";

// Modale « Mes paiements » — ouverte depuis la section Facturation. Le contenu
// provient de GET /api/payments/me (base Notion `Paiements` reliée au membre).
// On reprend exactement le rendu de l'ancienne section Paiements, déplacé ici.

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

const STATUS_STYLE: Record<
  Payment["statusCategory"],
  { bg: string; fg: string; border: string }
> = {
  paid: { bg: "rgba(39,174,142,0.10)", fg: "#16805f", border: "rgba(39,174,142,0.25)" },
  due: { bg: "rgba(91,141,239,0.10)", fg: "#2d5bb3", border: "rgba(91,141,239,0.25)" },
  refused: { bg: "rgba(224,98,90,0.10)", fg: "#b3433b", border: "rgba(224,98,90,0.25)" },
  unknown: { bg: "rgba(82,82,91,0.08)", fg: "#52525b", border: "rgba(82,82,91,0.20)" },
};

function sourceStyle(source: string | null): { bg: string; fg: string; border: string } {
  if (source === "Stripe")
    return { bg: "rgba(138,108,242,0.10)", fg: "#6b4dd1", border: "rgba(138,108,242,0.25)" };
  if (source === "Virement bancaire")
    return { bg: "rgba(39,174,142,0.08)", fg: "#16805f", border: "rgba(39,174,142,0.22)" };
  return { bg: "rgba(82,82,91,0.08)", fg: "#52525b", border: "rgba(82,82,91,0.20)" };
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

export function PaymentsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Lock scroll + Escape tant que la modale est ouverte.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // Charge les paiements à chaque ouverture.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      // `await Promise.resolve()` → sort les setState du corps synchrone de
      // l'effet (règle react-hooks/set-state-in-effect du repo).
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/payments/me", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) {
            if (!cancelled) setPayments([]);
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Erreur ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setPayments(data.payments ?? []);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Impossible de charger les paiements.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // `open` ne passe à true que côté client (clic utilisateur) → `document` est
  // toujours disponible quand on rend le portail.
  if (!open) return null;

  return createPortal(
    <div
      className="nc-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Mes paiements"
    >
      <div className="nc-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 18px",
            borderBottom: "1px solid var(--color-border-default)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                color: "var(--color-text-primary)",
              }}
            >
              Mes paiements
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: "var(--color-text-muted)",
              }}
            >
              Tous tes paiements sont centralisés ici.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            data-fb-label="Fermer · Modale paiements"
            style={{
              width: 36,
              height: 36,
              borderRadius: 9999,
              border: "1px solid var(--color-border-default)",
              background: "var(--color-surface-card)",
              color: "var(--color-text-secondary)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body scrollable */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: 18,
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
                borderRadius: 12,
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
                border: "1px dashed var(--color-border-default)",
                borderRadius: 12,
              }}
            >
              Aucun paiement enregistré pour le moment.
            </div>
          )}

          {!loading && payments && payments.length > 0 && (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                border: "1px solid var(--color-border-default)",
                borderRadius: 12,
                overflow: "hidden",
                background: "var(--color-surface-card)",
              }}
            >
              {payments.map((p, idx) => {
                const statusS = STATUS_STYLE[p.statusCategory];
                const sourceS = sourceStyle(p.source);
                return (
                  <li
                    key={p.notionId}
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

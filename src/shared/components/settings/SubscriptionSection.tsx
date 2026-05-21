"use client";

import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, LoaderCircle } from "lucide-react";

import { SettingsCard } from "./SettingsCard";
import type {
  PaymentHistoryItem,
  PaymentMethod,
  SubscriptionData,
  SubscriptionStatus,
} from "@/shared/lib/settings/mock-data";

type SubscriptionSectionProps = {
  subscription: SubscriptionData;
  history: PaymentHistoryItem[];
  paymentMethod: PaymentMethod | null;
};

// Forme renvoyée par GET /api/payments/me. On accepte engagement: null quand
// l'auth-user n'a pas (encore) de Sales Call rattaché dans la base Notion.
type Engagement = {
  notionId: string;
  notionUrl: string | null;
  fullName: string;
  amount: number | null;
  installmentPlan: string | null;
  state: string | null;
  status: SubscriptionStatus | "pending";
  closingDate: string | null;
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "À jour",
  expired: "Échéance dépassée",
  pending: "En attente",
};

const STATUS_STYLE: Record<
  SubscriptionStatus,
  { bg: string; fg: string; border: string }
> = {
  active: {
    bg: "rgba(39,174,142,0.10)",
    fg: "#16805f",
    border: "rgba(39,174,142,0.25)",
  },
  expired: {
    bg: "rgba(224,98,90,0.10)",
    fg: "#b3433b",
    border: "rgba(224,98,90,0.25)",
  },
  pending: {
    bg: "rgba(237,157,58,0.12)",
    fg: "#a36314",
    border: "rgba(237,157,58,0.25)",
  },
};

function formatEur(amount: number | null): string {
  if (amount === null) return "—";
  return amount.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
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

export function SubscriptionSection({
  subscription,
  history,
  paymentMethod,
}: SubscriptionSectionProps) {
  // Engagement réel fetché depuis la base Notion "Calls". Tant que la requête
  // n'a pas répondu (ou si elle échoue), on reste sur les données mock passées
  // en props pour ne pas afficher un état vide.
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [loadingEngagement, setLoadingEngagement] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/payments/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setEngagement(data.engagement ?? null);
      } catch {
        // Silencieux : on garde le fallback mock pour que l'écran ne casse pas
        // si Notion est down ou si l'utilisateur n'est pas auth.
      } finally {
        if (!cancelled) setLoadingEngagement(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Affichage : engagement Notion réel s'il existe, sinon données mock.
  const hasNotionEngagement = engagement !== null;
  const status: SubscriptionStatus = hasNotionEngagement
    ? (engagement.status as SubscriptionStatus)
    : subscription.status;
  const statusStyle = STATUS_STYLE[status];

  return (
    <SettingsCard
      title="Échéances de paiement"
      description="Suivez le montant total engagé, les échéances à venir et votre moyen de paiement."
    >
      {/* Engagement (ex-Plan) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: 18,
          borderRadius: 16,
          border: "1px solid var(--color-border-default)",
          background: "var(--color-surface-raised)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text-primary)",
            }}
          >
            {hasNotionEngagement
              ? engagement.fullName || "Engagement Notion Club"
              : subscription.planName}
          </p>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 10px",
              borderRadius: 9999,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
              color: statusStyle.fg,
              background: statusStyle.bg,
              border: `1px solid ${statusStyle.border}`,
            }}
          >
            {STATUS_LABEL[status]}
          </span>
          {loadingEngagement && (
            <LoaderCircle
              size={12}
              className="animate-spin"
              style={{ color: "var(--color-text-muted)" }}
            />
          )}
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          <KeyValue
            label="Montant total"
            value={
              hasNotionEngagement
                ? formatEur(engagement.amount)
                : subscription.priceLabel
            }
          />
          <KeyValue
            label="Modalité"
            value={
              hasNotionEngagement
                ? engagement.installmentPlan ?? "Paiement unique"
                : "Paiement unique"
            }
          />
          <KeyValue
            label="Date de closing"
            value={
              hasNotionEngagement
                ? formatDate(engagement.closingDate)
                : subscription.renewalDateLabel
            }
          />
        </div>
        {hasNotionEngagement && engagement.notionUrl && (
          <a
            href={engagement.notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              alignSelf: "flex-start",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 9999,
              border: "1px solid var(--color-border-default)",
              background: "white",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <ExternalLink size={12} />
            Voir le détail sur Notion
          </a>
        )}
      </div>

      {/* Historique de paiements
          NB : tant que la DB Notion "Paiements" (relation depuis Calls) n'est
          pas branchée, l'historique reste mocké. Voir le ticket OPS-41 dans la
          roadmap pour le suivi. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Historique de paiements
        </h3>
        <div
          style={{
            border: "1px solid var(--color-border-default)",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
          }}
        >
          {history.length === 0 && (
            <div
              style={{
                padding: "20px 14px",
                fontSize: 13,
                color: "var(--color-text-muted)",
                textAlign: "center",
              }}
            >
              Aucun paiement pour le moment.
            </div>
          )}
          {history.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 10,
                padding: "12px 14px",
                borderBottom:
                  idx === history.length - 1
                    ? "none"
                    : "1px solid var(--color-border-default)",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {item.description}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--color-text-muted)",
                  }}
                >
                  {item.date} ·{" "}
                  {item.status === "paid" ? "Payé" : "Remboursé"}
                </p>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexShrink: 0,
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
                  {item.amount}
                </p>
                <button
                  type="button"
                  disabled
                  aria-disabled
                  title="Disponible prochainement"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--color-text-muted)",
                    background: "transparent",
                    border: "none",
                    cursor: "not-allowed",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                    opacity: 0.7,
                  }}
                >
                  Télécharger
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Moyen de paiement */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text-primary)",
          }}
        >
          Moyen de paiement
        </h3>
        {!paymentMethod ? (
          <div
            style={{
              padding: "20px 14px",
              fontSize: 13,
              color: "var(--color-text-muted)",
              textAlign: "center",
              border: "1px dashed var(--color-border-default)",
              borderRadius: 12,
              background: "var(--color-surface-raised)",
            }}
          >
            Aucun moyen de paiement enregistré.
          </div>
        ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 14,
            borderRadius: 12,
            border: "1px solid var(--color-border-default)",
            background: "white",
          }}
        >
          <div
            style={{
              width: 42,
              height: 28,
              borderRadius: 6,
              background:
                paymentMethod.brand === "Visa"
                  ? "linear-gradient(135deg, #1a1f71 0%, #2c388f 100%)"
                  : "linear-gradient(135deg, #eb001b 0%, #f79e1b 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              flexShrink: 0,
            }}
          >
            {paymentMethod.brand === "Visa" ? "VISA" : "MC"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              •••• •••• •••• {paymentMethod.last4}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--color-text-muted)",
              }}
            >
              Expire {paymentMethod.expiry}
            </p>
          </div>
          <button
            type="button"
            disabled
            aria-disabled
            title="Disponible prochainement"
            style={{
              padding: "7px 14px",
              borderRadius: 9999,
              border: "1px solid var(--color-border-default)",
              background: "white",
              color: "var(--color-text-secondary)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "not-allowed",
              opacity: 0.7,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CreditCard size={13} />
            Modifier
          </button>
        </div>
        )}
      </div>
    </SettingsCard>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 500,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 500,
          color: "var(--color-text-primary)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

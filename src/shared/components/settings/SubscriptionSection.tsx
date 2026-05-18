import { CreditCard } from "lucide-react";

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

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: "Actif",
  expired: "Expiré",
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

export function SubscriptionSection({
  subscription,
  history,
  paymentMethod,
}: SubscriptionSectionProps) {
  const status = STATUS_STYLE[subscription.status];
  const isExpired = subscription.status === "expired";

  return (
    <SettingsCard
      title="Abonnement & facturation"
      description="Gérez votre offre, consultez vos paiements et votre moyen de paiement."
    >
      {/* Current plan */}
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
            {subscription.planName}
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
              color: status.fg,
              background: status.bg,
              border: `1px solid ${status.border}`,
            }}
          >
            {STATUS_LABEL[subscription.status]}
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          <KeyValue label="Prix" value={subscription.priceLabel} />
          <KeyValue
            label={isExpired ? "Date d'expiration" : "Prochain renouvellement"}
            value={subscription.renewalDateLabel}
          />
        </div>
        <div style={{ position: "relative", marginTop: 2 }}>
          <button
            type="button"
            disabled
            aria-disabled
            title="Disponible prochainement"
            style={{
              padding: "9px 16px",
              borderRadius: 9999,
              border: "1px solid var(--color-border-default)",
              background: "white",
              color: "var(--color-text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "not-allowed",
              opacity: 0.7,
            }}
          >
            Gérer mon abonnement
          </button>
        </div>
      </div>

      {/* Payment history */}
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

      {/* Payment method */}
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

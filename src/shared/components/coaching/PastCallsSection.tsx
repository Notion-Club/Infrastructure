import { CallCard } from "@/shared/components/coaching/CallCard";
import type { MockCall } from "@/shared/lib/mock/coaching";

interface PastCallsSectionProps {
  calls: MockCall[];
  emptyMessage?: string;
  bannerText?: string;
  archived?: boolean;
}

export function PastCallsSection({
  calls,
  emptyMessage = "Ton historique apparaîtra ici après ton premier coaching.",
  bannerText,
  archived = false,
}: PastCallsSectionProps) {
  return (
    <div>
      <h2
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: "0 0 12px",
        }}
      >
        Tes coachings passés
      </h2>

      {bannerText && (
        <div
          style={{
            fontSize: 13,
            color: "var(--color-text-secondary)",
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-default)",
            borderRadius: 10,
            padding: "8px 14px",
            marginBottom: 12,
          }}
        >
          {bannerText}
        </div>
      )}

      {calls.length === 0 ? (
        <p
          style={{
            fontSize: 14,
            color: "var(--color-text-muted)",
            margin: 0,
            padding: "16px 0",
          }}
        >
          {emptyMessage}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {calls.map((call) => (
            <CallCard key={call.id} call={call} archived={archived} />
          ))}
        </div>
      )}
    </div>
  );
}

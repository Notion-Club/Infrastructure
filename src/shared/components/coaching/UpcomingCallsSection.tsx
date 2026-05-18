import { CallCard } from "@/shared/components/coaching/CallCard";
import type { MockCall } from "@/shared/lib/mock/coaching";

interface UpcomingCallsSectionProps {
  calls: MockCall[];
  emptyMessage?: string;
}

export function UpcomingCallsSection({
  calls,
  emptyMessage = "Aucun coaching prévu pour le moment.",
}: UpcomingCallsSectionProps) {
  return (
    <div style={{ marginBottom: 28 }}>
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
        Tes prochains coachings
      </h2>

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
            <CallCard key={call.id} call={call} />
          ))}
        </div>
      )}
    </div>
  );
}

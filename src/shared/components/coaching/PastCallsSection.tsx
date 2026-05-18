import { CallCard } from "@/shared/components/coaching/CallCard";
import type { MockCall } from "@/shared/lib/mock/coaching";

const EYES_URL =
  "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/e2eb0709f7ba004d73ce96e041865c95deeaf80a/People/Eyes.webp";

interface PastCallsSectionProps {
  calls: MockCall[];
  bannerText?: string;
  archived?: boolean;
}

export function PastCallsSection({
  calls,
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
        <div
          style={{
            textAlign: "center",
            padding: "40px 16px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={EYES_URL}
            alt=""
            width={72}
            height={72}
            style={{ display: "block", margin: "0 auto 16px" }}
          />
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.45,
            }}
          >
            On s&apos;est jamais appelé,<br />ça serait peut-être l&apos;occasion
          </p>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ gap: 12, alignItems: "start" }}
        >
          {calls.map((call) => (
            <CallCard key={call.id} call={call} archived={archived} />
          ))}
        </div>
      )}
    </div>
  );
}

import { TranscriptLoadingText } from "notionclub-infra";

export const WithCoach = () => (
  <div
    style={{
      width: 480,
      textAlign: "center",
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "var(--color-text-primary)",
    }}
  >
    <TranscriptLoadingText host="Théo" />
  </div>
);

export const Generic = () => (
  <div
    style={{
      width: 480,
      textAlign: "center",
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      color: "var(--color-text-primary)",
    }}
  >
    <TranscriptLoadingText host="" />
  </div>
);

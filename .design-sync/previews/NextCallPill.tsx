import { NextCallPill } from "notionclub-infra";

export const InSeveralDays = () => (
  <NextCallPill
    data={{
      scheduledAt: "2026-06-22T14:00:00Z",
      host: "Théo",
      hostAvatarUrl: null,
      objectRequest: "Aide setup CRM client",
      rescheduleUrl: null,
    }}
  />
);

export const Tomorrow = () => (
  <NextCallPill
    data={{
      scheduledAt: "2026-06-19T10:30:00Z",
      host: "Noah",
      hostAvatarUrl: null,
      objectRequest: "Architecture de la base CRM",
      rescheduleUrl: "https://tidycal.com/reschedule",
    }}
  />
);

export const Today = () => (
  <NextCallPill
    data={{
      scheduledAt: "2026-06-18T17:00:00Z",
      host: "Théo",
      hostAvatarUrl: null,
      objectRequest: "Revue de progression",
      rescheduleUrl: null,
    }}
  />
);

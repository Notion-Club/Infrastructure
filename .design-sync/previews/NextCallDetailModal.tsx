import { NextCallDetailModal } from "notionclub-infra";

// Modale overlay (portal vers document.body, position fixed plein écran).
// Rendue en état ouvert. Nécessite probablement cardMode:single.
export const WithRequest = () => (
  <NextCallDetailModal
    isOpen
    onClose={() => {}}
    scheduledAt="2026-06-19T14:30:00Z"
    host="Théo"
    hostAvatarUrl={null}
    objectRequest="J'aimerais qu'on revoie ensemble la structure de ma base CRM et qu'on cale les automations Make pour l'onboarding client."
    rescheduleUrl="https://tidycal.com/notionclub/coaching"
  />
);

export const Minimal = () => (
  <NextCallDetailModal
    isOpen
    onClose={() => {}}
    scheduledAt="2026-06-20T10:00:00Z"
    host="Noah"
    hostAvatarUrl={null}
    objectRequest={null}
    rescheduleUrl={null}
  />
);

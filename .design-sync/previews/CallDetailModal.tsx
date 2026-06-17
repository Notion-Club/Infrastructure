import { CallDetailModal } from "notionclub-infra";

// Modale overlay (portal vers document.body, position fixed plein écran),
// rendue ouverte sur l'onglet « Plan d'actions ».
// ATTENTION : ce composant importe transitivement un module serveur
// (getCallTranscriptionBlocks) — peut rendre blanc en preview. Props minimales.
// Nécessite probablement cardMode:single.

const SUMMARY = `ACTION ITEMS
Mettre en place la relation Clients ↔ Projets avant le prochain appel.
Configurer une vue Kanban filtrée par statut de paiement.
Importer les 5 premiers clients pour tester la structure.

CONTEXTE
On a passé en revue la base CRM actuelle de Théo. La structure est solide mais manque de relations entre les tables, ce qui empêche les rollups de montant.

PROCHAINES ÉTAPES
Tester les automations Make sur l'onboarding, puis revoir ensemble le résultat lors du call suivant.`;

export const ActionPlan = () => (
  <CallDetailModal
    isOpen
    onClose={() => {}}
    subject="Structurer la base CRM dans Notion"
    summary={SUMMARY}
    host="Théo"
    hostAvatarUrl={null}
    date="2026-05-15T14:00:00Z"
    notionPageId={null}
    transcriptUrl={null}
  />
);

export const WithAIActions = () => (
  <CallDetailModal
    isOpen
    onClose={() => {}}
    subject="Stratégie de pricing et positionnement"
    summary={SUMMARY}
    host="Noah"
    hostAvatarUrl={null}
    date="2026-05-08T10:00:00Z"
    notionPageId={null}
    transcriptUrl="https://app.notionclub.fr/api/coaching/transcript/demo-token"
  />
);

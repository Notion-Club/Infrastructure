import { SubscriptionSection } from "notionclub-infra";

// SubscriptionSection fetches /api/payments/me on mount. In the static
// preview there is no API, so it settles into its empty / loading state —
// which is exactly one of the real UI states (mode démo, 401 → "aucun
// paiement enregistré").
export const Default = () => (
  <div style={{ width: 560 }}>
    <SubscriptionSection />
  </div>
);

import { UpcomingEmptyState } from "notionclub-infra";

export const Eligible = () => (
  <div style={{ width: 560 }}>
    <UpcomingEmptyState eligible />
  </div>
);

export const NotEligible = () => (
  <div style={{ width: 560 }}>
    <UpcomingEmptyState eligible={false} />
  </div>
);

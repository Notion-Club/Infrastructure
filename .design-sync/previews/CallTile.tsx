import { CallTile } from "notionclub-infra";

export const PastWithSummary = () => (
  <div style={{ width: 460 }}>
    <CallTile
      variant="past"
      call={{
        id: "2",
        date: "2026-05-15T14:00:00Z",
        host: "Théo",
        subject: "Mise en place du tracker d'objectifs",
        status: "accepted",
      }}
    />
  </div>
);

export const Upcoming = () => (
  <div style={{ width: 460 }}>
    <CallTile
      variant="upcoming"
      call={{
        id: "1",
        date: "2026-06-22T14:00:00Z",
        host: "Théo",
        subject: "Aide setup CRM client",
        status: "upcoming",
      }}
    />
  </div>
);

export const UpcomingTomorrow = () => (
  <div style={{ width: 460 }}>
    <CallTile
      variant="upcoming"
      call={{
        id: "9",
        date: "2026-06-19T10:30:00Z",
        host: "Noah",
        subject: "Architecture de la base CRM",
        status: "upcoming",
      }}
    />
  </div>
);

export const PastNoShow = () => (
  <div style={{ width: 460 }}>
    <CallTile
      variant="past"
      call={{
        id: "4",
        date: "2026-05-01T14:00:00Z",
        host: "Noah",
        subject: "Stratégie de pricing",
        status: "no_show",
      }}
    />
  </div>
);

export const Archived = () => (
  <div style={{ width: 460 }}>
    <CallTile
      variant="past"
      archived
      call={{
        id: "6",
        date: "2026-04-17T14:00:00Z",
        host: "Théo",
        subject: "Automatisation workflow client",
        status: "accepted",
      }}
    />
  </div>
);

// Types partagés entre le FeedbackWidget (état/overlays) et la section toolbox
// (icônes + brouillons + tickets dans le dropdown dev).

export interface Draft {
  id: string;
  element: string;
  elementUrl: string;
  action: string;
  end: string;
  page: string;
  text: string;
  timestamp: string;
  isGeneral?: boolean;
}

export interface NotionTicket {
  notionId: string;
  element: string;
  action: string;
  page: string;
  text: string;
  status: string;
  statusColor: string;
  timestamp: string;
}

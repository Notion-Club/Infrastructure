// Types partagés entre client et serveur pour les Web Push.

// Format renvoyé par `PushSubscription.toJSON()` côté navigateur — c'est
// ce que le client POST vers /api/push/subscribe.
export type PushSubscriptionJSON = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

// Payload reçu par le SW handler `push` (cf. public/sw.js). Tout est
// optionnel sauf `title` — `body` peut être vide pour des notifs
// minimales (style "ping").
export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    [k: string]: unknown;
  };
};

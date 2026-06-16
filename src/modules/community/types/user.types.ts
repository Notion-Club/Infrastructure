export type Offer = "free" | "paid";
export type Role = "member" | "admin" | "mentor";

export interface User {
  id: string;
  name: string;
  // Handle unique (profiles.username) — sert de clé de deep-link dans les URLs
  // de conversation (/communaute/messages/<username>). Auto-généré au signup
  // (cf. migration 010), donc présent en pratique ; nullable défensivement.
  username: string | null;
  avatarUrl: string | null;
  // Couleur de fond pour le placeholder d'avatar (initiales). Stockée en
  // DB (profiles.avatar_color). Si null, on retombe sur un hash deterministe
  // de l'id côté UI (UserAvatar).
  avatarColor: string | null;
  initials: string;
  role: Role;
  offer: Offer;
  joinedAt: string; // ISO date string
  deleted?: boolean;
}

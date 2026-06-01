export type Offer = "free" | "paid";
export type Role = "member" | "admin" | "mentor";

export interface User {
  id: string;
  name: string;
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

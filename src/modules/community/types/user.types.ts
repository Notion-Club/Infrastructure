export type Offer = "free" | "paid";
export type Role = "member" | "admin" | "mentor";

export interface User {
  id: string;
  name: string;
  avatarUrl: string | null;
  initials: string;
  role: Role;
  offer: Offer;
  joinedAt: string; // ISO date string
  deleted?: boolean;
}

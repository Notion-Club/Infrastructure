import type { User } from "../types/user.types";

export function canMentionUser(viewer: User, target: User): boolean {
  if (viewer.role === "admin" || viewer.role === "mentor") return true;
  if (target.role === "admin" || target.role === "mentor") return true;
  return viewer.offer === target.offer;
}

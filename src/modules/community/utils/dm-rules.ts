import type { User } from "../types/user.types";

export function canDMUser(viewer: User, target: User): boolean {
  if (viewer.id === target.id) return false;
  if (target.deleted) return false;

  if (target.role === "admin" || target.role === "mentor") return true;
  if (viewer.role === "admin" || viewer.role === "mentor") return true;

  return viewer.offer === target.offer;
}

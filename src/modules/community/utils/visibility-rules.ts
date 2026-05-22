import type { User } from "../types/user.types";
import type { Post } from "../types/post.types";

export function canViewPost(viewer: User, post: Post): boolean {
  if (viewer.role === "admin" || viewer.role === "mentor") return true;

  if (post.author.role === "admin" || post.author.role === "mentor") {
    if (post.audience === "all") return true;
    if (post.audience === "free_only") return viewer.offer === "free";
    if (post.audience === "paid_only") return viewer.offer === "paid";
    return false;
  }

  if (post.author.offer === "free") return viewer.offer === "free";
  if (post.author.offer === "paid") return viewer.offer === "paid";

  return false;
}

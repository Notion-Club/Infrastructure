"use client";

import { useMemo } from "react";
import { MOCK_POSTS } from "../mocks/posts.mock";
import type { Post, PostTag } from "../types/post.types";
import type { User } from "../types/user.types";
import { canViewPost } from "../utils/visibility-rules";

export function usePostsFiltered(
  viewer: User,
  activeTag: PostTag | "all"
): Post[] {
  return useMemo(() => {
    const visible = MOCK_POSTS.filter((p) => canViewPost(viewer, p));
    const tagged =
      activeTag === "all"
        ? visible
        : visible.filter((p) => p.tag === activeTag);
    // Pinned always first, then by date desc
    return [...tagged].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [viewer, activeTag]);
}

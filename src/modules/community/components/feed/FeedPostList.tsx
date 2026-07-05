"use client";

import { useState, useEffect, useRef, type RefObject } from "react";
import type { Post } from "../../types/post.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { PostCard } from "./PostCard";
import { FeedEmptyState } from "./FeedEmptyState";

const PAGE_SIZE = 10;

interface FeedPostListProps {
  posts: Post[];
  currentUser: User;
  devRole: DevRole;
  // Conteneur à scroll interne (#nc-feed-scroll). Sert de `root` à
  // l'IntersectionObserver : le feed ne scrolle plus le document mais ce
  // conteneur → sans ce root, la sentinelle n'entrerait jamais dans le
  // viewport et la pagination ne se déclencherait pas.
  scrollRootRef?: RefObject<HTMLDivElement | null>;
}

export function FeedPostList({ posts, currentUser, devRole, scrollRootRef }: FeedPostListProps) {
  const [page, setPage] = useState(1);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visible = posts.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length < posts.length;

  useEffect(() => {
    setPage(1);
  }, [posts]);

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setPage((p) => p + 1);
      },
      { root: scrollRootRef?.current ?? null, rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, scrollRootRef]);

  if (posts.length === 0) return <FeedEmptyState />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {visible.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          devRole={devRole}
          pinned={post.pinned}
        />
      ))}
      {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}
      {!hasMore && posts.length > PAGE_SIZE && (
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", margin: "8px 0" }}>
          Tous les posts chargés
        </p>
      )}
    </div>
  );
}

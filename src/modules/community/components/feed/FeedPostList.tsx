"use client";

import { useState, useEffect, useRef, useCallback, type RefObject } from "react";
import { LoaderCircle } from "lucide-react";
import type { Post, PostCursor, PostTag } from "../../types/post.types";
import type { User } from "../../types/user.types";
import type { DevRole } from "../../hooks/useDevRoleToggle";
import { loadMorePosts } from "../../server/actions";
import { PostCard } from "./PostCard";
import { FeedEmptyState } from "./FeedEmptyState";

interface FeedPostListProps {
  // 1re page paginée (keyset) streamée par le serveur — tag "all". Sert d'état
  // initial ; la suite est chargée au scroll et un changement de tag recharge
  // la page 1 du tag, tout côté serveur.
  initialPosts: Post[];
  initialCursor: PostCursor | null;
  initialHasMore: boolean;
  // Posts publiés localement (optimistic) — insérés en tête, filtrés par tag.
  optimisticPosts: Post[];
  activeTag: PostTag | "all";
  currentUser: User;
  devRole: DevRole;
  // Conteneur à scroll interne (#nc-feed-scroll) = `root` de l'IntersectionObserver.
  scrollRootRef?: RefObject<HTMLDivElement | null>;
}

interface FeedState {
  items: Post[];
  cursor: PostCursor | null;
  hasMore: boolean;
}

export function FeedPostList({
  initialPosts,
  initialCursor,
  initialHasMore,
  optimisticPosts,
  activeTag,
  currentUser,
  devRole,
  scrollRootRef,
}: FeedPostListProps) {
  const [feed, setFeed] = useState<FeedState>({
    items: initialPosts,
    cursor: initialCursor,
    hasMore: initialHasMore,
  });
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Tag que reflètent actuellement `feed.items` (le serveur pagine par tag).
  const loadedTagRef = useRef<PostTag | "all">("all");
  // « Dernière requête gagne » : un changement de tag pendant un chargement
  // invalide la réponse en vol (append d'un autre tag / page périmée).
  const reqIdRef = useRef(0);
  // Verrou synchrone (ref, pas d'état) : plusieurs intersections peuvent tirer
  // avant que `isLoading` (asynchrone) ne repasse à true → sans lui, doublons.
  const loadingRef = useRef(false);

  // Lance un chargement serveur. `replace` = 1re page d'un tag (reset) ;
  // `append` = page suivante (scroll). La réponse périmée (reqId dépassé) est
  // ignorée SANS libérer le verrou : c'est la requête gagnante qui le gère.
  const runLoad = useCallback(
    (cursor: PostCursor | null, tag: PostTag | "all", mode: "replace" | "append") => {
      const reqId = ++reqIdRef.current;
      loadingRef.current = true;
      setIsLoading(true);
      loadMorePosts(cursor, tag)
        .then((page) => {
          if (reqId !== reqIdRef.current) return;
          setFeed((prev) => {
            if (mode === "replace") {
              return { items: page.posts, cursor: page.nextCursor, hasMore: page.hasMore };
            }
            // Dédup par id à l'append (sécurité anti-doublon de frontière).
            const seen = new Set(prev.items.map((p) => p.id));
            const fresh = page.posts.filter((p) => !seen.has(p.id));
            return {
              items: [...prev.items, ...fresh],
              cursor: page.nextCursor,
              hasMore: page.hasMore,
            };
          });
          loadingRef.current = false;
          setIsLoading(false);
        })
        .catch(() => {
          if (reqId !== reqIdRef.current) return;
          loadingRef.current = false;
          setIsLoading(false);
        });
    },
    [],
  );

  // Resync depuis les props quand la 1re page « all » change (router.refresh
  // après publication, nouvelle promesse SSR). On ne resynchronise que si les
  // items reflètent le tag « all » — sinon on préserve la liste du tag courant.
  useEffect(() => {
    if (loadedTagRef.current !== "all") return;
    setFeed({ items: initialPosts, cursor: initialCursor, hasMore: initialHasMore });
  }, [initialPosts, initialCursor, initialHasMore]);

  // Changement de tag → recharge la page 1 du tag côté serveur (reset).
  useEffect(() => {
    if (activeTag === loadedTagRef.current) return;
    loadedTagRef.current = activeTag;
    runLoad(null, activeTag, "replace");
  }, [activeTag, runLoad]);

  // Scroll infini : à l'intersection, charge la page suivante du tag courant.
  // Recréé quand cursor/hasMore changent → l'observer se ré-abonne avec la
  // bonne valeur de curseur (pas de closure périmée).
  const loadMore = useCallback(() => {
    if (loadingRef.current || !feed.hasMore) return;
    runLoad(feed.cursor, loadedTagRef.current, "append");
  }, [feed.hasMore, feed.cursor, runLoad]);

  useEffect(() => {
    if (!feed.hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: scrollRootRef?.current ?? null, rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [feed.hasMore, scrollRootRef, loadMore]);

  // Affichage : optimistic (filtrés par tag) en tête, puis items serveur, dédup
  // par id. Les posts publiés localement restent visibles en tête jusqu'à ce que
  // router.refresh les ramène dans la page serveur.
  const seen = new Set<string>();
  const display: Post[] = [];
  for (const p of optimisticPosts) {
    if (activeTag !== "all" && p.tag !== activeTag) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    display.push(p);
  }
  for (const p of feed.items) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    display.push(p);
  }

  if (display.length === 0 && !isLoading) return <FeedEmptyState />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {display.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={currentUser}
          devRole={devRole}
          pinned={post.pinned}
        />
      ))}

      {/* Sentinelle du scroll infini (déclenche loadMore à 200px). */}
      {feed.hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

      {isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }} aria-live="polite">
          <LoaderCircle size={18} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
        </div>
      )}

      {!feed.hasMore && !isLoading && display.length > 0 && (
        <p style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)", margin: "8px 0" }}>
          Tous les posts chargés
        </p>
      )}
    </div>
  );
}

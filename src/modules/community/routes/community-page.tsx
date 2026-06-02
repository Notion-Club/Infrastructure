"use client";

import { useMemo, useState, useEffect, useRef, useTransition, useCallback, useLayoutEffect } from "react";
import { MessageCircle, Users, SquarePen } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { PostTag } from "../types/post.types";
import { useDevRoleToggle } from "../hooks/useDevRoleToggle";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { FeedTagFilters } from "../components/feed/FeedTagFilters";
import { FeedPostList } from "../components/feed/FeedPostList";
import { FeedSkeletonState } from "../components/feed/FeedSkeletonState";
import { FeedErrorState } from "../components/feed/FeedErrorState";
import { PostComposerModal } from "../components/post-composer/PostComposerModal";
import { MessagesLayout } from "../components/messages/MessagesLayout";
import { DevRoleToggle } from "../components/dev/DevRoleToggle";
import { GradualBlurOverlay } from "@/shared/components/GradualBlurOverlay";
import { ImageLightboxRoot } from "../components/shared/ImageLightboxRoot";
import { CommunityRestrictedPage } from "./community-restricted-page";
import { createPostAction } from "../server/actions";
import type { Post } from "../types/post.types";
import type { Conversation } from "../types/conversation.types";

type Tab = "feed" | "messages";
type TagFilter = PostTag | "all";

const COMMUNITY_TABS: Tab[] = ["feed", "messages"];

interface CommunityPageProps {
  initialTab?: Tab;
  initialConversationId?: string | null;
  initialPosts: Post[];
  initialConversations: Conversation[];
}

export function CommunityPage({
  initialTab = "feed",
  initialConversationId,
  initialPosts,
  initialConversations,
}: CommunityPageProps) {
  const { role, setRole, feedState, setFeedState } = useDevRoleToggle();
  const currentUser = useCurrentUser(role);
  const router = useRouter();

  // Restore scroll position saved before navigating into a post detail
  useEffect(() => {
    try {
      const savedY = sessionStorage.getItem("communaute:scrollY");
      if (savedY) {
        sessionStorage.removeItem("communaute:scrollY");
        const y = parseInt(savedY, 10);
        requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
      }
    } catch {}
  }, []);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [activeTag, setActiveTag] = useState<TagFilter>("all");

  const tabItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabPillRef  = useRef<HTMLDivElement>(null);
  const tabLastClickedRef = useRef<number>(-1);

  const moveTabTo = useCallback((idx: number, animate: boolean) => {
    const el   = tabItemRefs.current[idx];
    const pill = tabPillRef.current;
    if (!el || !pill) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.top    = `${el.offsetTop}px`;
      pill.style.height = `${el.offsetHeight}px`;
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${el.offsetLeft}px)`;
      pill.style.width     = `${el.offsetWidth}px`;
    }
  }, []);

  useLayoutEffect(() => {
    const idx = COMMUNITY_TABS.indexOf(activeTab);
    if (tabLastClickedRef.current === idx) {
      tabLastClickedRef.current = -1;
      return;
    }
    tabLastClickedRef.current = -1;
    moveTabTo(idx, false);
  }, [activeTab, moveTabTo]);
  const [showComposer, setShowComposer] = useState(false);
  // Optimistic posts ajoutés côté client juste après publication. À chaque
  // router.refresh() post-create, le Server Component recharge initialPosts
  // avec la vraie ligne DB et l'optimistic est dédoublonné par id.
  const [optimisticPosts, setOptimisticPosts] = useState<Post[]>([]);
  const [publishing, startPublish] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Desktop only: redirect wheel events fired over the page (rose halo zone,
  // header, etc.) into the inner scroll container so the feed scrolls even
  // when the cursor is outside the white card. Modals/dropdowns are portaled
  // to document.body — outside .nc-page-halo — so their wheel events never
  // reach this listener and keep native scrolling.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const pageEl = scroller.closest(".nc-page-halo");
    if (!pageEl) return;

    function onWheel(e: Event) {
      const el = scrollRef.current;
      if (!el) return;
      const we = e as WheelEvent;
      if (window.matchMedia("(max-width: 767px)").matches) return;
      if (we.deltaY === 0) return;
      if (el.contains(we.target as Node)) return;
      el.scrollTop += we.deltaY;
      we.preventDefault();
    }

    pageEl.addEventListener("wheel", onWheel, { passive: false });
    return () => pageEl.removeEventListener("wheel", onWheel);
  }, [activeTab]);

  // Merge optimistic + initialPosts, dédoublonne par id, filtre par tag,
  // trie (pinned d'abord puis date desc).
  const allPosts = useMemo(() => {
    const seen = new Set<string>();
    const merged: Post[] = [];
    for (const p of [...optimisticPosts, ...initialPosts]) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      merged.push(p);
    }
    const filtered = activeTag === "all"
      ? merged
      : merged.filter((p) => p.tag === activeTag);
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [optimisticPosts, initialPosts, activeTag]);

  const canViewCommunity = true;
  if (!canViewCommunity) return <CommunityRestrictedPage />;

  function handlePublish(partial: Partial<Post>) {
    const titleNormalized = (partial.title ?? "").trim();
    const bodyNormalized = (partial.body ?? "").trim();
    if (!titleNormalized || !bodyNormalized) return;

    startPublish(async () => {
      const result = await createPostAction({
        title: titleNormalized,
        body: bodyNormalized,
        tag: partial.tag ?? "general",
        audience: partial.audience ?? "all",
        pinned: partial.pinned ?? false,
        pinned_until: null,
        image_url: partial.imageUrl ?? null,
        video_url: null,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      const optimistic: Post = {
        id: result.postId,
        author: currentUser,
        tag: partial.tag ?? "general",
        audience: partial.audience ?? "all",
        title: titleNormalized,
        body: bodyNormalized,
        imageUrl: partial.imageUrl,
        pinned: partial.pinned ?? false,
        reactions: [],
        commentCount: 0,
        createdAt: new Date().toISOString(),
      };
      setOptimisticPosts((prev) => [optimistic, ...prev]);
      setShowComposer(false);
      toast.success("Post publié");
      router.refresh();
    });
  }

  const showSkeleton = feedState === "loading";
  const showError = feedState === "error";

  return (
    <>
      {/* Lightbox globale : capte les CustomEvent 'nc-image-open' émis
          par linkify.tsx quand l'utilisateur clique sur une image inline
          dans un body de post / commentaire. */}
      <ImageLightboxRoot />

      {/* Global container card */}
      <div
        className="md:flex md:flex-col md:flex-1 md:min-h-0"
        style={{
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 20,
          boxShadow: "var(--nc-shadow-3)",
          overflow: "hidden",
        }}
      >
        {/* iOS-style pill switcher — full width, sticky header */}
        <div
          className="md:shrink-0"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--color-border-default)",
            background: "var(--color-surface-card)",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "var(--color-surface-raised)",
              borderRadius: 10,
              padding: 3,
              gap: 2,
              position: "relative",
            }}
          >
            {/* Pill glissante */}
            <div
              ref={tabPillRef}
              aria-hidden
              className="nc-nav-pill"
              style={{
                position: "absolute",
                left: 0,
                background: "var(--nc-segmented-active-bg)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)",
                borderRadius: 8,
                pointerEvents: "none",
                willChange: "transform, width",
                zIndex: 0,
              }}
            />

            {(
              [
                { value: "feed" as Tab, label: "Feed", icon: Users, badge: 0 },
                { value: "messages" as Tab, label: "Messages", icon: MessageCircle, badge: initialConversations.reduce((s, c) => s + c.unreadCount, 0) },
              ]
            ).map(({ value, label, icon: Icon, badge }, i) => {
              const isActive = activeTab === value;
              return (
                <button
                  key={value}
                  ref={(el) => { tabItemRefs.current[i] = el; }}
                  type="button"
                  onClick={() => {
                    tabLastClickedRef.current = i;
                    moveTabTo(i, true);
                    setActiveTab(value);
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: isActive ? "var(--nc-segmented-active-bg)" : "transparent",
                    boxShadow: isActive
                      ? "0 1px 4px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.08)"
                      : "none",
                    color: isActive ? "var(--nc-segmented-active-text)" : "var(--color-text-muted)",
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                    cursor: "pointer",
                    position: "relative",
                    zIndex: 1,
                    transition: "background 200ms var(--nc-ease), box-shadow 200ms var(--nc-ease), color 200ms ease",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                  {badge > 0 && (
                    <span
                      style={{
                        minWidth: 16,
                        height: 16,
                        background: "var(--color-brand)",
                        color: "#fff",
                        borderRadius: 9999,
                        fontSize: 10,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {activeTab === "feed" ? (
          <>
            {/* Tag filters + new post — sticky header */}
            <div className="md:shrink-0" style={{ padding: "16px 16px 12px" }}>
              <FeedTagFilters
                active={activeTag}
                onChange={setActiveTag}
                onNewPost={() => setShowComposer(true)}
                isAdmin={currentUser.role === "admin"}
              />
            </div>

            {/* Post list — the only vertically scrollable zone */}
            <div
              ref={scrollRef}
              className="md:flex-1 md:min-h-0 md:overflow-y-auto"
              style={{ padding: "0 16px 16px" }}
            >
              {showSkeleton ? (
                <FeedSkeletonState />
              ) : showError ? (
                <FeedErrorState onRetry={() => setFeedState("full")} />
              ) : (
                <FeedPostList
                  posts={feedState === "empty" ? [] : allPosts}
                  currentUser={currentUser}
                  devRole={role}
                />
              )}
            </div>
          </>
        ) : (
          <div className="md:flex-1 md:min-h-0 md:overflow-hidden">
            <MessagesLayout
              currentUser={currentUser}
              devRole={role}
              initialConversations={initialConversations}
              initialConversationId={initialConversationId}
              embedded
            />
          </div>
        )}
      </div>

      {/* FAB mobile — accès rapide à l'éditeur de post, sous le pouce,
          au-dessus de la BottomNav. Masqué sur desktop (bouton inline). */}
      {activeTab === "feed" && (
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="nc-feed-fab md:hidden"
          aria-label="Nouveau post"
        >
          <SquarePen size={22} strokeWidth={2.25} />
        </button>
      )}

      {showComposer && (
        <PostComposerModal
          currentUser={currentUser}
          onClose={() => setShowComposer(false)}
          onPublish={handlePublish}
          publishing={publishing}
        />
      )}

      <DevRoleToggle
        role={role}
        onRoleChange={setRole}
        feedState={feedState}
        onFeedStateChange={setFeedState}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { MessageCircle, Users, SquarePen } from "lucide-react";
import type { PostTag } from "../types/post.types";
import { useDevRoleToggle } from "../hooks/useDevRoleToggle";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { usePostsFiltered } from "../hooks/usePostsFiltered";
import { FeedTagFilters } from "../components/feed/FeedTagFilters";
import { FeedPostList } from "../components/feed/FeedPostList";
import { FeedSkeletonState } from "../components/feed/FeedSkeletonState";
import { FeedErrorState } from "../components/feed/FeedErrorState";
import { PostComposerModal } from "../components/post-composer/PostComposerModal";
import { MessagesLayout } from "../components/messages/MessagesLayout";
import { DevRoleToggle } from "../components/dev/DevRoleToggle";
import { GradualBlurOverlay } from "@/shared/components/GradualBlurOverlay";
import { CommunityRestrictedPage } from "./community-restricted-page";
import type { Post } from "../types/post.types";
import { MOCK_CONVERSATIONS } from "../mocks/conversations.mock";

type Tab = "feed" | "messages";
type TagFilter = PostTag | "all";

const UNREAD_DM = MOCK_CONVERSATIONS.reduce((s, c) => s + c.unreadCount, 0);

interface CommunityPageProps {
  initialTab?: Tab;
  initialConversationId?: string | null;
}

export function CommunityPage({ initialTab = "feed", initialConversationId }: CommunityPageProps) {
  const { role, setRole, feedState, setFeedState } = useDevRoleToggle();
  const currentUser = useCurrentUser(role);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [activeTag, setActiveTag] = useState<TagFilter>("all");
  const [showComposer, setShowComposer] = useState(false);
  const [extraPosts, setExtraPosts] = useState<Post[]>([]);

  const filteredPosts = usePostsFiltered(currentUser, activeTag);
  const allPosts = [
    ...extraPosts.filter((p) => activeTag === "all" || p.tag === activeTag),
    ...filteredPosts,
  ].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const canViewCommunity = true;
  if (!canViewCommunity) return <CommunityRestrictedPage />;

  function handlePublish(partial: Partial<Post>) {
    const newPost: Post = {
      id: `new-${Date.now()}`,
      author: currentUser,
      tag: partial.tag ?? "general",
      audience: partial.audience ?? "all",
      title: partial.title,
      body: partial.body ?? "",
      pinned: partial.pinned ?? false,
      reactions: [],
      commentCount: 0,
      createdAt: new Date().toISOString(),
    };
    setExtraPosts((prev) => [newPost, ...prev]);
    setShowComposer(false);
  }

  const showSkeleton = feedState === "loading";
  const showError = feedState === "error";

  return (
    <>
      {/* Global container card */}
      <div
        style={{
          background: "var(--color-surface-raised)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 20,
          boxShadow: "var(--nc-shadow-3)",
          overflow: "hidden",
        }}
      >
        {/* iOS-style pill switcher — full width */}
        <div
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
            }}
          >
            {(
              [
                { value: "feed" as Tab, label: "Feed", icon: Users, badge: 0 },
                { value: "messages" as Tab, label: "Messages", icon: MessageCircle, badge: UNREAD_DM },
              ]
            ).map(({ value, label, icon: Icon, badge }) => {
              const isActive = activeTab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveTab(value)}
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
        <div style={{ padding: activeTab === "messages" ? 0 : 16 }}>
          {activeTab === "feed" && (
            <div
              style={{
                position: "relative",
                maxHeight: "calc(100dvh - 240px)",
                minHeight: 400,
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  /* Réserve la hauteur du voile de flou sticky (120px) pour
                     que le dernier post reste entièrement lisible au scroll. */
                  paddingBottom: 120,
                }}
              >
                <FeedTagFilters
                  active={activeTag}
                  onChange={setActiveTag}
                  onNewPost={() => setShowComposer(true)}
                  isAdmin={currentUser.role === "admin"}
                />
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
              <GradualBlurOverlay position="sticky" zIndex={1} />
            </div>
          )}

          {activeTab === "messages" && (
            <MessagesLayout
              currentUser={currentUser}
              devRole={role}
              initialConversationId={initialConversationId}
              embedded
            />
          )}
        </div>
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

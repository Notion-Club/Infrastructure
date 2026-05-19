"use client";

import { useState } from "react";
import { Users, MessageCircle } from "lucide-react";
import type { PostTag } from "../types/post.types";
import { useDevRoleToggle } from "../hooks/useDevRoleToggle";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { usePostsFiltered } from "../hooks/usePostsFiltered";
import { MOCK_NOTIFICATIONS } from "../mocks/notifications.mock";
import { FeedTagFilters } from "../components/feed/FeedTagFilters";
import { FeedPostList } from "../components/feed/FeedPostList";
import { FeedSkeletonState } from "../components/feed/FeedSkeletonState";
import { FeedErrorState } from "../components/feed/FeedErrorState";
import { PostComposerModal } from "../components/post-composer/PostComposerModal";
import { MessagesLayout } from "../components/messages/MessagesLayout";
import { DevRoleToggle } from "../components/dev/DevRoleToggle";
import { NotificationPopover } from "../components/notifications/NotificationPopover";
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
  const allPosts = [...extraPosts.filter((p) => {
    // filter extra posts by same logic
    if (activeTag !== "all" && p.tag !== activeTag) return false;
    return true;
  }), ...filteredPosts];

  // Simulate restricted (Formation-only user)
  const canViewCommunity = true; // In real app: check user capability

  if (!canViewCommunity) {
    return <CommunityRestrictedPage />;
  }

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
  const showEmpty = feedState === "empty";

  return (
    <>
      {/* Page */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <h1
                style={{
                  fontSize: "clamp(28px, 4vw, 40px)",
                  fontWeight: 800,
                  color: "var(--color-text-primary)",
                  margin: "0 0 4px",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                Communauté
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted)" }}>
                Échangez avec la communauté Notion Club
              </p>
            </div>
            {/* Notification bell desktop */}
            <div className="hidden md:flex">
              <NotificationPopover />
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 4,
              marginTop: 20,
              borderBottom: "1px solid var(--color-border-default)",
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
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 16px",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? "var(--color-text-primary)" : "var(--color-text-muted)",
                    borderBottom: isActive ? "2px solid var(--color-text-primary)" : "2px solid transparent",
                    marginBottom: -1,
                    transition: "color 150ms ease, border-color 150ms ease",
                    position: "relative",
                  }}
                >
                  <Icon size={16} />
                  {label}
                  {badge && badge > 0 && (
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

        {/* Feed tab */}
        {activeTab === "feed" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            ) : showEmpty ? (
              <FeedPostList posts={[]} currentUser={currentUser} devRole={role} />
            ) : (
              <FeedPostList posts={allPosts} currentUser={currentUser} devRole={role} />
            )}
          </div>
        )}

        {/* Messages tab */}
        {activeTab === "messages" && (
          <MessagesLayout
            currentUser={currentUser}
            devRole={role}
            initialConversationId={initialConversationId}
          />
        )}
      </div>

      {/* Composer modal */}
      {showComposer && (
        <PostComposerModal
          currentUser={currentUser}
          onClose={() => setShowComposer(false)}
          onPublish={handlePublish}
        />
      )}

      {/* Dev toggle */}
      <DevRoleToggle
        role={role}
        onRoleChange={setRole}
        feedState={feedState}
        onFeedStateChange={setFeedState}
      />
    </>
  );
}

"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CommunityPage } from "@/modules/community/routes/community-page";
import type { Post } from "@/modules/community/types/post.types";
import type { Conversation } from "@/modules/community/types/conversation.types";

export function CommunityPageClient({
  initialPosts,
  initialConversations,
}: {
  initialPosts: Post[];
  initialConversations: Conversation[];
}) {
  const params = useSearchParams();
  const router = useRouter();
  const tab = params.get("tab") === "messages" ? "messages" : "feed";
  const conversation = params.get("conversation") ?? null;

  // Clean URL params immediately after they've been consumed — prevents
  // stale ?tab=messages&conversation=X from re-triggering DM routing on
  // subsequent back/forward navigations.
  useEffect(() => {
    if (params.get("tab") || params.get("conversation")) {
      router.replace("/communaute");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CommunityPage
      key={`${tab}-${conversation ?? ""}`}
      initialTab={tab as "feed" | "messages"}
      initialConversationId={conversation}
      initialPosts={initialPosts}
      initialConversations={initialConversations}
    />
  );
}

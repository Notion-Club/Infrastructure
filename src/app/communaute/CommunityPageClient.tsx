"use client";

import { useSearchParams } from "next/navigation";
import { CommunityPage } from "@/modules/community/routes/community-page";

export function CommunityPageClient() {
  const params = useSearchParams();
  const tab = params.get("tab") === "messages" ? "messages" : "feed";
  const conversation = params.get("conversation") ?? null;

  return <CommunityPage initialTab={tab as "feed" | "messages"} initialConversationId={conversation} />;
}

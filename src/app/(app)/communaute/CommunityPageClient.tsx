"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CommunityPage } from "@/modules/community/routes/community-page";

export function CommunityPageClient() {
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
    />
  );
}


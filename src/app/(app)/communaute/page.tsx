import type { Metadata } from "next";
import { Suspense } from "react";
import { listConversations, listPosts } from "@/modules/community/server/queries";
import { CommunityPageClient } from "./CommunityPageClient";

export const metadata: Metadata = {
  title: "Communauté — Notion Club",
};

// Async Server Component — pré-fetch des posts pour rendre le feed côté
// serveur. La RLS posts_select_community filtre déjà selon le viewer
// (offer free / paid via user_has_capability).
export default async function CommunautePage() {
  const [initialPosts, initialConversations] = await Promise.all([
    listPosts(),
    listConversations(),
  ]);

  return (
    <div className="nc-page-halo flex flex-col min-h-dvh md:h-dvh md:overflow-hidden">
        <main
          className="flex flex-col flex-1 min-h-0 w-full mx-auto px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[88px] md:pb-6"
          style={{ position: "relative", zIndex: 1, maxWidth: 840 }}
        >
          <Suspense fallback={null}>
            <CommunityPageClient
              initialPosts={initialPosts}
              initialConversations={initialConversations}
            />
          </Suspense>
        </main>
    </div>
  );
}

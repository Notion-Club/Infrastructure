import { Suspense } from "react";
import { listConversations, listPosts } from "@/modules/community/server/queries";
import { CommunityPage } from "@/modules/community/routes/community-page";

// Shell partagé par toutes les routes /communaute/* (feed, messages,
// messages/[username]). Pré-fetch posts + conversations côté serveur, puis
// monte CommunityPage en lui passant l'onglet actif (dérivé de l'URL, plus
// d'un state local) et le username de conversation éventuel.
//
// Pourquoi un shell partagé plutôt qu'un layout.tsx + sous-pages distinctes ?
// Le switcher feed/messages, la card et l'animation de pill vivent dans
// CommunityPage (un seul client component). Le découper en layout + slots
// casserait l'animation et dupliquerait le data-fetch. On garde donc
// CommunityPage entier, monté par chaque route avec les bons props d'URL.

export async function CommunityShell({
  tab,
  conversationUsername,
}: {
  tab: "feed" | "messages";
  conversationUsername?: string | null;
}) {
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
          <CommunityPage
            activeTab={tab}
            conversationUsername={conversationUsername ?? null}
            initialPosts={initialPosts}
            initialConversations={initialConversations}
          />
        </Suspense>
      </main>
    </div>
  );
}

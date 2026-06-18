import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conversation · Communauté · Notion Club",
};

// Marqueur de route. /communaute/messages/<username> : le shell persistant
// CommunityPage (monté par communaute/layout.tsx) lit le segment <username>
// via usePathname() et ouvre la conversation correspondante. La page elle-même
// ne rend rien (sinon elle re-monterait un sous-arbre à chaque navigation).
export default function CommunauteConversationPage() {
  return null;
}

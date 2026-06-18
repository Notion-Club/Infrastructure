import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Communauté · Notion Club",
};

// Marqueur de route. Le rendu (feed) vit dans communaute/layout.tsx, qui monte
// le shell persistant CommunityPage (lequel dérive la vue de usePathname()).
export default function CommunauteFeedPage() {
  return null;
}

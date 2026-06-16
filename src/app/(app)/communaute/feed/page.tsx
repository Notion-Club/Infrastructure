import type { Metadata } from "next";
import { CommunityShell } from "../CommunityShell";

export const metadata: Metadata = {
  title: "Communauté — Notion Club",
};

// /communaute/feed — onglet feed du module communauté.
export default function CommunauteFeedPage() {
  return <CommunityShell tab="feed" />;
}

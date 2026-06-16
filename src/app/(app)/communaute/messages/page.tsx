import type { Metadata } from "next";
import { CommunityShell } from "../CommunityShell";

export const metadata: Metadata = {
  title: "Messages — Communauté — Notion Club",
};

// /communaute/messages — onglet messages (liste des conversations, aucune
// conversation ouverte).
export default function CommunauteMessagesPage() {
  return <CommunityShell tab="messages" />;
}

import type { Metadata } from "next";
import { CommunityShell } from "../../CommunityShell";

export const metadata: Metadata = {
  title: "Conversation — Communauté — Notion Club",
};

// /communaute/messages/<username> — onglet messages avec la conversation
// ouverte sur l'utilisateur <username>. La résolution username → conversation
// (création si elle n'existe pas encore) est faite côté client dans
// MessagesLayout (logique existante de résolution, étendue au username).
//
// Next.js 16 : params est asynchrone et doit être awaité.
export default async function CommunauteConversationPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <CommunityShell tab="messages" conversationUsername={username} />;
}

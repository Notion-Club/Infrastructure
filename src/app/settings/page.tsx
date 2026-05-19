import type { Metadata } from "next";
import { EmailNotVerifiedBanner } from "@/modules/auth";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Réglages — Notion Club",
};

export default function SettingsPage() {
  // Le banner est un Server Component, il faut le rendre dans la page
  // Server Component et le passer en `children`/prop au Client. C'est plus
  // robuste que d'importer un Server Component dans un Client Component
  // (Next.js l'interdit).
  return <SettingsClient banner={<EmailNotVerifiedBanner />} />;
}

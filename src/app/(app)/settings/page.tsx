import type { Metadata } from "next";
import { EmailConfirmBanner } from "@/shared/components/dashboard/EmailConfirmBanner";
import { getNotificationSettings } from "@/modules/settings";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Réglages · Notion Club",
};

export default async function SettingsPage() {
  // Pré-fetch des préférences notifications côté serveur pour éviter le bug
  // historique du composant qui partait sur des defaults hardcodés à chaque
  // mount. Si l'user n'est pas auth (cas mock dev), getNotificationSettings
  // renvoie null et le client utilise ses defaults.
  const initialNotificationSettings = await getNotificationSettings();
  return (
    <SettingsClient
      banner={<EmailConfirmBanner />}
      initialNotificationSettings={initialNotificationSettings}
    />
  );
}

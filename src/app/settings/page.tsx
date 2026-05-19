import type { Metadata } from "next";
import { SettingsClient } from "./SettingsClient";

export const metadata: Metadata = {
  title: "Réglages — Notion Club",
};

export default function SettingsPage() {
  return <SettingsClient />;
}

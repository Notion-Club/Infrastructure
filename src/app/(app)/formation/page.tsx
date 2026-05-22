import type { Metadata } from "next";

import { FormationIndexClient } from "@/modules/formation";

export const metadata: Metadata = {
  title: "Formation — Notion Club",
};

export default function FormationPage() {
  return <FormationIndexClient />;
}

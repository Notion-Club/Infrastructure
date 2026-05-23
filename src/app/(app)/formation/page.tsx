import type { Metadata } from "next";

import { FormationIndex, getAccessiblePrograms } from "@/modules/formation";

export const metadata: Metadata = {
  title: "Formation — Notion Club",
};

export default async function FormationPage() {
  const programs = await getAccessiblePrograms();
  return <FormationIndex programs={programs} />;
}

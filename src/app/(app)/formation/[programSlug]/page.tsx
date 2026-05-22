import type { Metadata } from "next";

import { ProgramPageClient } from "@/modules/formation";

export const metadata: Metadata = {
  title: "Programme — Formation — Notion Club",
};

// Next 16 : les params dynamiques sont des Promises côté Server Component.
type Params = Promise<{ programSlug: string }>;

export default async function ProgramPage({ params }: { params: Params }) {
  const { programSlug } = await params;
  return <ProgramPageClient programSlug={programSlug} />;
}

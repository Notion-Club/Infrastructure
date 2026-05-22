import type { Metadata } from "next";

import { LessonPageClient } from "@/modules/formation";

export const metadata: Metadata = {
  title: "Leçon — Formation — Notion Club",
};

// Next 16 : les params dynamiques sont des Promises côté Server Component.
type Params = Promise<{
  programSlug: string;
  moduleSlug: string;
  lessonSlug: string;
}>;

export default async function LessonPage({ params }: { params: Params }) {
  const { programSlug, moduleSlug, lessonSlug } = await params;
  return (
    <LessonPageClient
      programSlug={programSlug}
      moduleSlug={moduleSlug}
      lessonSlug={lessonSlug}
    />
  );
}

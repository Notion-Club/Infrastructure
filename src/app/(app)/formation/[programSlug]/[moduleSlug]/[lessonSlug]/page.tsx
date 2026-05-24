import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  LessonView,
  getLessonView,
  touchCourseAccess,
} from "@/modules/formation";
import { fetchPageBlocks } from "@/shared/lib/notion/blocks";

export const metadata: Metadata = {
  title: "Leçon — Formation — Notion Club",
};

type Params = Promise<{
  programSlug: string;
  moduleSlug: string;
  lessonSlug: string;
}>;

export default async function LessonPage({ params }: { params: Params }) {
  const { programSlug, moduleSlug, lessonSlug } = await params;

  const res = await getLessonView(programSlug, moduleSlug, lessonSlug);
  if (!res.ok) {
    const code = res.reason === "no_capability" ? "denied" : res.reason;
    redirect(`${res.redirectTo}?notice=${code}`);
  }

  // Lazy : le body Notion n'est fetché qu'à l'ouverture de la leçon.
  // Marque la leçon comme "vue" (pour le Reprendre) en parallèle.
  const [blocks] = await Promise.all([
    fetchPageBlocks(res.view.course.notionId),
    touchCourseAccess(res.view.course.id),
  ]);

  return <LessonView view={res.view} blocks={blocks} />;
}

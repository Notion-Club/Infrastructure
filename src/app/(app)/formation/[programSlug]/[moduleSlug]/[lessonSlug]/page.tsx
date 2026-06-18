import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  LessonView,
  getLessonView,
  touchCourseAccess,
  fetchLessonContent,
} from "@/modules/formation";

export const metadata: Metadata = {
  title: "Leçon · Formation · Notion Club",
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

  // Lazy : vidéo + Synthèse + ressources liées récupérés à l'ouverture.
  // Marque la leçon comme « vue » (Reprendre) en parallèle.
  const [content] = await Promise.all([
    fetchLessonContent(res.view.course.notionId),
    touchCourseAccess(res.view.course.id),
  ]);

  return <LessonView view={res.view} content={content} />;
}

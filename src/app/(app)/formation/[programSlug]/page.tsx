import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProgramView, getProgramDetail } from "@/modules/formation";

export const metadata: Metadata = {
  title: "Programme — Formation — Notion Club",
};

type Params = Promise<{ programSlug: string }>;
type Search = Promise<{ module?: string }>;

export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { programSlug } = await params;
  const { module: openModuleSlug } = await searchParams;
  const detail = await getProgramDetail(programSlug);

  // RLS : si la formation n'est pas accessible (ou inexistante), getProgramDetail
  // renvoie null → on renvoie vers l'index avec un toast.
  if (!detail) {
    redirect("/formation?notice=denied");
  }

  return <ProgramView detail={detail} openModuleSlug={openModuleSlug} />;
}

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const metadata = {
  title: "Dashboard — Notion Club",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signup");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">Connecté en tant que {user.email}</p>
      <p className="text-xs text-muted-foreground">
        Placeholder — sera remplacé par le dashboard de la Brique 2.
      </p>
    </main>
  );
}

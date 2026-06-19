// Server wrapper de /membres (page admin « Gestion des membres ») :
//   1. Garde admin — un non-admin est redirigé vers /dashboard (la page n'est
//      de toute façon atteignable que depuis le dev tool admin de la navbar).
//   2. Lit les vrais membres + agrégats via getMembersAdminData (tables
//      Supabase réelles) et passe le payload au client component.
//
// Intégrée dans le layout (app) commun comme /coaching et /communaute :
// hérite automatiquement de la Topbar, MobileTopActions et BottomNav.

import { redirect } from "next/navigation";

import { isRequestAdmin } from "@/shared/lib/auth/requireAdmin";
import { getMembersAdminData } from "@/modules/admin/server/getMembersAdminAction";
import MembresPageClient from "./MembresPageClient";

export const dynamic = "force-dynamic";

export default async function MembresPage() {
  if (!(await isRequestAdmin())) {
    redirect("/dashboard");
  }

  const data = await getMembersAdminData();

  return (
    <MembresPageClient members={data.members} offers={data.offers} />
  );
}

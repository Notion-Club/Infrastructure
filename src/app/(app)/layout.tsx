import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import {
  ProfileIdentityProvider,
  type ProfileIdentity,
} from "@/shared/components/identity/ProfileIdentityProvider";
import FeedbackWidgetLoader from "@/shared/components/feedback-widget/FeedbackWidgetLoader";
import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { DevToolboxProvider } from "@/shared/components/dev/DevToolbox";
import { AdminPushRegistrar } from "@/shared/components/dev/admin-push/AdminPushRegistrar";

// Layout commun à toutes les pages connectées (dashboard, settings, communaute,
// coaching, ressources). Server Component : on pré-fetch l'identity de l'user
// (profile + auth) une seule fois et on la passe au ProfileIdentityProvider
// qui la diffuse via Context aux composants client (Topbar, MobileTopActions,
// ProfileHero). Plus de flash "initiales → photo" au chargement.
//
// Si l'user n'est pas authentifié, on redirige vers /login.

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Pré-fetch en parallèle : profile + capability can_view_paid_content
  // (dérive l'offer affichée dans le module community).
  const [profileRes, paidRes] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "first_name, last_name, display_name, username, avatar_url, avatar_color, role",
      )
      .eq("id", user.id)
      .maybeSingle<{
        first_name: string | null;
        last_name: string | null;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
        avatar_color: string | null;
        role: string | null;
      }>(),
    supabase.rpc("user_has_capability", {
      p_profile_id: user.id,
      p_capability: "can_view_paid_content",
    }),
  ]);

  const profile = profileRes.data;
  const hasPaidAccess = paidRes.data === true;
  const rawRole = profile?.role ?? "member";
  const role: ProfileIdentity["role"] =
    rawRole === "admin" || rawRole === "mentor" ? rawRole : "member";

  const identity: ProfileIdentity = {
    id: user.id,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    displayName: profile?.display_name ?? null,
    username: profile?.username ?? null,
    email: user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    avatarColor: profile?.avatar_color ?? null,
    role,
    offer: hasPaidAccess ? "paid" : "free",
  };

  return (
    <ProfileIdentityProvider initialIdentity={identity}>
      <DevToolboxProvider>
        <AdminPushRegistrar />
        <Topbar />
        <div className="md:hidden">
          <MobileTopActions />
          <BottomNav />
        </div>
        {children}
        <FeedbackWidgetLoader />
      </DevToolboxProvider>
    </ProfileIdentityProvider>
  );
}

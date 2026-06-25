import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import { getAuthUser, getCurrentProfile } from "@/shared/lib/supabase/cached";
import {
  ProfileIdentityProvider,
  type ProfileIdentity,
} from "@/shared/components/identity/ProfileIdentityProvider";
import FeedbackWidgetLoader from "@/shared/components/feedback-widget/FeedbackWidgetLoader";
import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { MobileBrandLogo } from "@/shared/components/dashboard/mobile/MobileBrandLogo";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { DevToolboxProvider } from "@/shared/components/dev/DevToolbox";
import { AdminPushRegistrar } from "@/shared/components/dev/admin-push/AdminPushRegistrar";
import { ProfileModalProvider } from "@/shared/components/profile/ProfileModalProvider";
import { PwaInstallPrompt } from "@/shared/components/pwa/PwaInstallPrompt";

// Layout commun à toutes les pages connectées (dashboard, settings, communaute,
// coaching, ressources). Server Component : on pré-fetch l'identity de l'user
// (profile + auth) une seule fois et on la passe au ProfileIdentityProvider
// qui la diffuse via Context aux composants client (Topbar, MobileTopActions,
// ProfileHero). Plus de flash "initiales → photo" au chargement.
//
// Si l'user n'est pas authentifié, on redirige vers /login.

export default async function AppLayout({ children }: { children: ReactNode }) {
  // getAuthUser() est mémoïsé (cache()) : le même appel est réutilisé par la
  // page et les widgets de ce rendu, au lieu d'un getUser() par composant.
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // Pré-fetch en parallèle : profile (mémoïsé, partagé avec le greeting de la
  // page) + capability can_view_paid_content (dérive l'offer du module
  // community).
  const [profile, paidRes] = await Promise.all([
    getCurrentProfile(),
    supabase.rpc("user_has_capability", {
      p_profile_id: user.id,
      p_capability: "can_view_paid_content",
    }),
  ]);

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
        <ProfileModalProvider>
          <AdminPushRegistrar />
          <Topbar />
          <div className="md:hidden">
            {/* Zones de flou permanentes (toutes les pages connectées) :
                frosted en haut (status bar iOS) + fondu en bas (sous la
                BottomNav). Décoratives, pointer-events:none → ne capturent
                jamais le tap. Toute nouvelle page hérite de l'effet. */}
            <div className="nc-mobile-top-blur" aria-hidden />
            <div className="nc-mobile-top-fade" aria-hidden />
            <MobileBrandLogo />
            <MobileTopActions />
            <BottomNav />
            <div className="nc-mobile-bottom-blur" aria-hidden />
            <div className="nc-mobile-bottom-fade" aria-hidden />
          </div>
          {children}
          <FeedbackWidgetLoader />
          {/* Pop-up d'incitation à installer la PWA — s'ouvre auto quelques
              secondes après l'arrivée, sauf si déjà en mode standalone. */}
          <PwaInstallPrompt />
        </ProfileModalProvider>
      </DevToolboxProvider>
    </ProfileIdentityProvider>
  );
}

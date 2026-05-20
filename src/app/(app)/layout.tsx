import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/shared/lib/supabase/server";
import {
  ProfileIdentityProvider,
  type ProfileIdentity,
} from "@/shared/components/identity/ProfileIdentityProvider";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, last_name, display_name, username, avatar_url, avatar_color",
    )
    .eq("id", user.id)
    .maybeSingle<{
      first_name: string | null;
      last_name: string | null;
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
      avatar_color: string | null;
    }>();

  const identity: ProfileIdentity = {
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    displayName: profile?.display_name ?? null,
    username: profile?.username ?? null,
    email: user.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    avatarColor: profile?.avatar_color ?? null,
  };

  return (
    <ProfileIdentityProvider initialIdentity={identity}>
      {children}
    </ProfileIdentityProvider>
  );
}

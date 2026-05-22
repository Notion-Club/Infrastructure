"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { ProfileHero } from "@/shared/components/settings/ProfileHero";
import { ProfileSection } from "@/shared/components/settings/ProfileSection";
import { SecuritySection } from "@/shared/components/settings/SecuritySection";
import { SubscriptionSection } from "@/shared/components/settings/SubscriptionSection";
import { NotificationsSection } from "@/shared/components/settings/NotificationsSection";
import { AppearanceSection } from "@/shared/components/settings/AppearanceSection";
import { DangerZone } from "@/shared/components/settings/DangerZone";
import { DevPanel } from "@/shared/components/settings/DevPanel";
import type {
  AuthIdentity,
  AuthUserShape,
  ProfileRow,
} from "@/shared/components/settings/types";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import { useProfileIdentityContext } from "@/shared/components/identity/ProfileIdentityProvider";
import {
  MOCK_AUTH_USER,
  MOCK_PROFILE,
  MOCK_USER_OFFER,
} from "@/shared/lib/settings/mock-data";
import { type ScenarioId } from "@/shared/lib/settings/scenarios";
import type { NotificationSettings } from "@/modules/settings";

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      profile: ProfileRow;
      user: AuthUserShape;
      isMocked: boolean;
    };

export function SettingsClient({
  banner,
  initialNotificationSettings,
}: {
  banner?: React.ReactNode;
  initialNotificationSettings?: NotificationSettings | null;
} = {}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [scenarioId, setScenarioId] = useState<ScenarioId>("default");
  const { updateIdentity } = useProfileIdentityContext();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw error ?? new Error("no-user");
        const authUser = data.user;
        const { data: profileRow } = await supabase
          .from("profiles")
          .select(
            "id, avatar_url, avatar_color, display_name, first_name, last_name, username, bio, phone, communication_email, notion_email",
          )
          .eq("id", authUser.id)
          .maybeSingle<ProfileRow>();
        const profile: ProfileRow = profileRow ?? {
          id: authUser.id,
          avatar_url: null,
          avatar_color: null,
          display_name: null,
          first_name: null,
          last_name: null,
          username: null,
          bio: null,
          phone: null,
          communication_email: null,
          notion_email: null,
        };
        const user: AuthUserShape = {
          id: authUser.id,
          email: authUser.email ?? "",
          identities: (authUser.identities ?? []) as AuthIdentity[],
        };
        if (!cancelled) setState({ status: "ready", profile, user, isMocked: false });
      } catch {
        if (!cancelled)
          setState({
            status: "ready",
            profile: MOCK_PROFILE,
            user: MOCK_AUTH_USER,
            isMocked: true,
          });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function patchAvatar(next: {
    avatarUrl?: string | null;
    avatarColor?: string | null;
  }) {
    setState((prev) => {
      if (prev.status !== "ready") return prev;
      const patched = { ...prev.profile };
      if (next.avatarUrl !== undefined) patched.avatar_url = next.avatarUrl;
      if (next.avatarColor !== undefined)
        patched.avatar_color = next.avatarColor;
      return { ...prev, profile: patched };
    });
    // Propagate to the shared identity context so Topbar/Mobile reflect
    // the change immediately (without a full reload).
    updateIdentity({
      ...(next.avatarUrl !== undefined && { avatarUrl: next.avatarUrl }),
      ...(next.avatarColor !== undefined && { avatarColor: next.avatarColor }),
    });
  }

  return (
    <>
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              maxWidth: 680,
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
            className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-12"
          >
            {state.status === "loading" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "80px 0",
                  color: "var(--color-text-muted)",
                }}
              >
                <LoaderCircle size={20} className="animate-spin" />
              </div>
            ) : (
              <>
                <ProfileHero
                  avatarUrl={state.profile.avatar_url}
                  avatarColor={state.profile.avatar_color}
                  firstName={state.profile.first_name}
                  lastName={state.profile.last_name}
                  displayName={state.profile.display_name}
                  email={state.user.email}
                  isMocked={state.isMocked}
                  onAvatarChange={patchAvatar}
                />
                {banner}
                {state.isMocked && (
                  <div
                    role="status"
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "rgba(237,157,58,0.12)",
                      border: "1px solid rgba(237,157,58,0.25)",
                      color: "#a36314",
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    Mode démo — connectez-vous pour enregistrer vos modifications.
                  </div>
                )}
                <ProfileSection
                  profile={state.profile}
                  accountEmail={state.user.email}
                  isMocked={state.isMocked}
                />
                <SecuritySection user={state.user} isMocked={state.isMocked} />
                <SubscriptionSection />
                <NotificationsSection
                  userOffer={MOCK_USER_OFFER}
                  isMocked={state.isMocked}
                  initialSettings={initialNotificationSettings ?? null}
                />
                <AppearanceSection />
                <DangerZone isMocked={state.isMocked} />
              </>
            )}
          </div>
        </main>
      </div>

      <DevPanel scenarioId={scenarioId} onScenarioChange={setScenarioId} />
    </>
  );
}

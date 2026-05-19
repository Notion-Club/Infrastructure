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
import {
  MOCK_AUTH_USER,
  MOCK_PROFILE,
  MOCK_USER_OFFER,
} from "@/shared/lib/settings/mock-data";
import { findScenario, type ScenarioId } from "@/shared/lib/settings/scenarios";

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      profile: ProfileRow;
      user: AuthUserShape;
      isMocked: boolean;
    };

export function SettingsClient({ banner }: { banner?: React.ReactNode } = {}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [scenarioId, setScenarioId] = useState<ScenarioId>("default");

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
            "id, avatar_url, display_name, first_name, last_name, phone, notion_email",
          )
          .eq("id", authUser.id)
          .maybeSingle<ProfileRow>();
        const profile: ProfileRow = profileRow ?? {
          id: authUser.id,
          avatar_url: null,
          display_name: null,
          first_name: null,
          last_name: null,
          phone: null,
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

  const scenario = findScenario(scenarioId);

  function patchAvatar(url: string) {
    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, profile: { ...prev.profile, avatar_url: url } }
        : prev,
    );
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
                  userId={state.user.id}
                  avatarUrl={state.profile.avatar_url}
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
                <SubscriptionSection
                  subscription={scenario.subscription}
                  history={scenario.history}
                  paymentMethod={scenario.paymentMethod}
                />
                <NotificationsSection
                  userId={state.user.id}
                  userOffer={MOCK_USER_OFFER}
                  isMocked={state.isMocked}
                />
                <AppearanceSection />
                <DangerZone />
              </>
            )}
          </div>
        </main>
      </div>

      <DevPanel scenarioId={scenarioId} onScenarioChange={setScenarioId} />
    </>
  );
}

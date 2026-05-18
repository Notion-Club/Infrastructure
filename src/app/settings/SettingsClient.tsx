"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { SettingsHeader } from "@/shared/components/settings/SettingsHeader";
import { ProfileSection } from "@/shared/components/settings/ProfileSection";
import { SecuritySection } from "@/shared/components/settings/SecuritySection";
import { SubscriptionSection } from "@/shared/components/settings/SubscriptionSection";
import { NotificationsSection } from "@/shared/components/settings/NotificationsSection";
import { AppearanceSection } from "@/shared/components/settings/AppearanceSection";
import { DangerZone } from "@/shared/components/settings/DangerZone";
import type {
  AuthIdentity,
  AuthUserShape,
  ProfileRow,
} from "@/shared/components/settings/types";
import { createSupabaseBrowserClient } from "@/shared/lib/supabase/client";
import {
  MOCK_AUTH_USER,
  MOCK_PAYMENT_HISTORY,
  MOCK_PAYMENT_METHOD,
  MOCK_PROFILE,
  MOCK_SUBSCRIPTION,
  MOCK_USER_OFFER,
} from "@/shared/lib/settings/mock-data";

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      profile: ProfileRow;
      user: AuthUserShape;
      isMocked: boolean;
    };

export function SettingsClient() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

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
                <SettingsHeader
                  avatarUrl={state.profile.avatar_url}
                  displayName={state.profile.display_name}
                  email={state.user.email}
                />
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
                  isMocked={state.isMocked}
                />
                <SecuritySection user={state.user} isMocked={state.isMocked} />
                <SubscriptionSection
                  subscription={MOCK_SUBSCRIPTION}
                  history={MOCK_PAYMENT_HISTORY}
                  paymentMethod={MOCK_PAYMENT_METHOD}
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
    </>
  );
}

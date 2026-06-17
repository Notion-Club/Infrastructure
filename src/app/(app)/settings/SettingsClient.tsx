"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";

import { ProfileRecapCard } from "@/shared/components/settings/ProfileRecapCard";
import { AccountSection } from "@/shared/components/settings/AccountSection";
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
import { ContentEnter } from "@/shared/components/motion/ContentEnter";
import {
  MOCK_AUTH_USER,
  MOCK_PROFILE,
  MOCK_USER_OFFER,
} from "@/shared/lib/settings/mock-data";
import { type NotificationSettings } from "@/modules/settings";

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

  return (
    <>
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
              <ContentEnter
                style={{ display: "flex", flexDirection: "column", gap: 20 }}
              >
                <ProfileRecapCard />
                {banner}
                {state.isMocked && (
                  <div
                    role="status"
                    data-fb-label="Badge mode démo · Réglages"
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
                <AccountSection
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
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start"
                  style={{ width: "100%" }}
                >
                  <AppearanceSection />
                  <DangerZone isMocked={state.isMocked} />
                </div>
              </ContentEnter>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { SettingsSkeleton } from "@/shared/components/settings/SettingsSkeleton";

import { ProfileRecapCard } from "@/shared/components/settings/ProfileRecapCard";
import { AccountSection } from "@/shared/components/settings/AccountSection";
import { SecuritySection } from "@/shared/components/settings/SecuritySection";
import { NotificationsSection } from "@/shared/components/settings/NotificationsSection";
import { BillingSection } from "@/shared/components/settings/BillingSection";
import { DangerZone } from "@/shared/components/settings/DangerZone";
import { IntegrationsSection } from "@/shared/components/settings/IntegrationsSection";
import {
  SettingsCard,
  SettingsDivider,
} from "@/shared/components/settings/SettingsCard";
import type {
  AuthIdentity,
  AuthUserShape,
  CompanyEmbed,
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
      company: CompanyEmbed | null;
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
            "id, avatar_url, avatar_color, display_name, first_name, last_name, username, bio, phone, communication_email, billing_type, billing_company_id, billing_name, billing_address_line1, billing_address_line2, billing_postal_code, billing_city, billing_country, company:billing_company_id ( name, siret, vat_number, address_line1, address_line2, postal_code, city, country )",
          )
          .eq("id", authUser.id)
          .maybeSingle<ProfileRow & { company: CompanyEmbed | CompanyEmbed[] | null }>();
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
          billing_type: "individual",
          billing_company_id: null,
          billing_name: null,
          billing_address_line1: null,
          billing_address_line2: null,
          billing_postal_code: null,
          billing_city: null,
          billing_country: null,
        };
        // L'embed PostgREST peut renvoyer un objet ou un tableau selon
        // l'inférence de relation — on normalise en objet unique ou null.
        const embedded = profileRow?.company ?? null;
        const company: CompanyEmbed | null = Array.isArray(embedded)
          ? (embedded[0] ?? null)
          : embedded;
        const user: AuthUserShape = {
          id: authUser.id,
          email: authUser.email ?? "",
          identities: (authUser.identities ?? []) as AuthIdentity[],
        };
        if (!cancelled)
          setState({ status: "ready", profile, company, user, isMocked: false });
      } catch {
        if (!cancelled)
          setState({
            status: "ready",
            profile: MOCK_PROFILE,
            company: null,
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
              <SettingsSkeleton />
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
                    Mode démo. Connecte-toi pour enregistrer tes modifications.
                  </div>
                )}
                {/* « Mes informations » et « Sécurité » fusionnés dans un seul
                    encadré, séparés par un filet, via le mode `embedded`. */}
                <SettingsCard fbLabel="Compte & sécurité · Réglages">
                  <AccountSection
                    profile={state.profile}
                    accountEmail={state.user.email}
                    isMocked={state.isMocked}
                    embedded
                  />
                  <SettingsDivider />
                  <SecuritySection
                    user={state.user}
                    isMocked={state.isMocked}
                    embedded
                  />
                </SettingsCard>
                <IntegrationsSection />
                <BillingSection
                  profile={state.profile}
                  company={state.company}
                  isMocked={state.isMocked}
                />
                <NotificationsSection
                  userOffer={MOCK_USER_OFFER}
                  isMocked={state.isMocked}
                  initialSettings={initialNotificationSettings ?? null}
                />
                {/* #81 — La section « Apparence » a été retirée des réglages :
                    le thème se règle désormais uniquement depuis le menu
                    utilisateur (dropdown Topbar / MobileTopActions). */}
                <DangerZone isMocked={state.isMocked} />
              </ContentEnter>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

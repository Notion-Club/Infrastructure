"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { ProfileHero } from "@/shared/components/settings/ProfileHero";
import { ProfileSection } from "@/shared/components/settings/ProfileSection";
import { SecuritySection } from "@/shared/components/settings/SecuritySection";
import { SubscriptionSection } from "@/shared/components/settings/SubscriptionSection";
import { NotificationsSection } from "@/shared/components/settings/NotificationsSection";
import { DangerZone } from "@/shared/components/settings/DangerZone";
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
import { updateProfileAction, type NotificationSettings } from "@/modules/settings";

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

  // OPS-47 — Sauvegarde du nom d'affichage depuis l'inline-edit dans
  // ProfileHero. Optimistic update local + propagation au context identité
  // (Topbar / MobileTopActions s'actualisent immédiatement), puis appel
  // server action. En cas d'erreur on toast l'utilisateur sans revert : il
  // garde la nouvelle valeur dans l'input pour pouvoir corriger et retenter.
  async function patchDisplayName(nextDisplayName: string) {
    if (state.status !== "ready") return;
    const previous = state.profile.display_name;
    const trimmed = nextDisplayName.trim() || null;

    // Optimistic update
    setState((prev) =>
      prev.status === "ready"
        ? { ...prev, profile: { ...prev.profile, display_name: trimmed } }
        : prev,
    );
    updateIdentity({ displayName: trimmed });

    if (state.isMocked) {
      toast.success("Nom d'affichage mis à jour (démo)");
      return;
    }

    const result = await updateProfileAction({ display_name: trimmed });
    if (!result.ok) {
      // Revert optimistic update on server failure.
      setState((prev) =>
        prev.status === "ready"
          ? { ...prev, profile: { ...prev.profile, display_name: previous } }
          : prev,
      );
      updateIdentity({ displayName: previous });
      toast.error(result.message);
      throw new Error(result.message);
    }
    toast.success("Nom d'affichage mis à jour");
  }

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
                  onDisplayNameSave={patchDisplayName}
                />
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
                <DangerZone isMocked={state.isMocked} />
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

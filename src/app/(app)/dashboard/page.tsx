import type { Metadata } from "next";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { FormationWidget } from "@/shared/components/dashboard/widgets/FormationWidget";
import { ProfilWidget } from "@/shared/components/dashboard/widgets/ProfilWidget";
import { EmailVerifiedToast, LogoutButton } from "@/modules/auth";
import { EmailConfirmBanner } from "@/shared/components/dashboard/EmailConfirmBanner";
import { createSupabaseServerClient } from "@/shared/lib/supabase/server";

export const metadata: Metadata = {
  title: "Accueil — Notion Club",
};

// Récupère le prénom du user courant pour le greeting. Fallback :
//   1. profiles.first_name (renseigné au signup email/password)
//   2. profiles.display_name (cas où first_name absent, ex: Google OAuth)
//   3. partie locale de l'email (fallback ultime)
//   4. "à toi" si pas de user connecté (la page n'est pas encore protégée
//      par middleware, donc un visiteur anon peut tomber dessus)
async function getGreetingFirstName(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "à toi";

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.first_name) return profile.first_name;
  if (profile?.display_name) return profile.display_name;
  if (user.email) return user.email.split("@")[0];
  return "à toi";
}

export default async function DashboardPage() {
  const firstName = await getGreetingFirstName();
  return (
    <>
      {/* Éléments fixed hors de nc-page-halo pour éviter que isolation:isolate
          casse position:fixed dans certains navigateurs */}
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
      <main style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            maxWidth: 840,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
          className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10"
        >
          {/* Toast post-clic du lien de confirmation (?email_verified=…).
              Wrappé en Suspense car useSearchParams empêche le prerender
              statique sinon. */}
          <Suspense fallback={null}>
            <EmailVerifiedToast />
          </Suspense>

          {/* Greeting + search — desktop uniquement */}
          <div className="hidden md:flex flex-col gap-5">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--color-text-muted)",
                  margin: 0,
                }}
              >
                Bon retour
              </p>
              <h1
                style={{
                  fontSize: "clamp(42px, 5vw, 64px)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "var(--color-text-primary)",
                  margin: 0,
                  lineHeight: 1.1,
                }}
              >
                Salut {firstName}&nbsp;👋
              </h1>
            </div>

            {/* Search bar desktop */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: "var(--color-surface-card)",
                border: "1px solid var(--color-border-default)",
                borderRadius: 9999,
                padding: "11px 20px",
                maxWidth: 480,
                cursor: "pointer",
                boxShadow: "var(--nc-shadow-3)",
                transition: "box-shadow 200ms ease, border-color 200ms ease",
              }}
              className="hover:border-[var(--color-text-muted)] hover:shadow-[rgba(0,0,0,0.08)_0px_4px_24px_0px]"
            >
              <Search
                size={15}
                style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: 14,
                  color: "var(--color-text-muted)",
                  flex: 1,
                }}
              >
                Rechercher un cours, une ressource…
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-muted)",
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border-default)",
                  borderRadius: 6,
                  padding: "2px 6px",
                  fontWeight: 500,
                  flexShrink: 0,
                  lineHeight: 1.5,
                }}
              >
                ⌘K
              </span>
            </div>
          </div>

          {/* Greeting — mobile uniquement */}
          <div className="md:hidden flex flex-col gap-1">
            <h1
              style={{
                fontSize: "clamp(36px, 9vw, 48px)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--color-text-primary)",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              Salut {firstName}&nbsp;👋
            </h1>
          </div>

          {/* Search bar — mobile uniquement */}
          <div
            className="md:hidden flex items-center gap-2 bg-[var(--color-surface-card)] border border-[var(--color-border-default)] rounded-full px-4 py-2.5"
            style={{ cursor: "pointer" }}
          >
            <Search
              size={14}
              style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Rechercher un cours, une ressource…
            </span>
          </div>

          {/* Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EmailConfirmBanner />
            <FormationWidget />
            <ProfilWidget />

            {/* Placeholder zone future */}
            <div
              className="col-span-1 md:col-span-2"
              style={{
                border: "1.5px dashed var(--color-border-default)",
                borderRadius: 16,
                background: "transparent",
                height: 80,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--color-text-muted)",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  color: "var(--color-border-default)",
                  lineHeight: 1,
                }}
              >
                +
              </span>
              Communauté · Coaching · à venir
            </div>
          </div>

          {/* Logout temporaire (OPS-15) — à déplacer dans le menu utilisateur du Topbar */}
          <div className="flex justify-center pt-4">
            <LogoutButton />
          </div>
        </div>
      </main>
      </div>
    </>
  );
}

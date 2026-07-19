import type { Metadata } from "next";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { FormationWidget } from "@/shared/components/dashboard/widgets/FormationWidget";
import { ProfilWidget } from "@/shared/components/dashboard/widgets/ProfilWidget";
import { EmailVerifiedToast } from "@/modules/auth";
import { EmailConfirmBanner } from "@/shared/components/dashboard/EmailConfirmBanner";
import { ContentEnter } from "@/shared/components/motion/ContentEnter";
import { WidgetCardSkeleton } from "@/shared/components/dashboard/DashboardSkeleton";
import { getAuthUser, getCurrentProfile } from "@/shared/lib/supabase/cached";
import {
  getDashboardFormationData,
  getDashboardProfilData,
} from "@/modules/formation/server/dashboard";

export const metadata: Metadata = {
  title: "Accueil · Notion Club",
};

// Récupère le prénom du user courant pour le greeting. Fallback :
//   1. profiles.first_name (renseigné au signup email/password)
//   2. profiles.display_name (cas où first_name absent, ex: Google OAuth)
//   3. partie locale de l'email (fallback ultime)
//   4. "à toi" si pas de user connecté (la page n'est pas encore protégée
//      par middleware, donc un visiteur anon peut tomber dessus)
async function getGreetingFirstName(): Promise<string> {
  // Réutilise les lectures mémoïsées (cache()) déjà effectuées par le layout —
  // aucun getUser()/profiles supplémentaire n'est émis ici.
  const [user, profile] = await Promise.all([
    getAuthUser(),
    getCurrentProfile(),
  ]);
  if (!user) return "à toi";

  if (profile?.first_name) return profile.first_name;
  if (profile?.display_name) return profile.display_name;
  if (user.email) return user.email.split("@")[0];
  return "à toi";
}

// Bloc widgets — isolé dans sa propre frontière Suspense pour STREAMER
// indépendamment du shell (greeting + recherche). Les données formation/profil
// (les requêtes les plus lentes) ne bloquent plus l'affichage de l'en-tête :
// la page paint immédiatement, les widgets arrivent dès qu'ils sont prêts.
// getAccessiblePrograms() étant mémoïsé (cache()), les 2 dérivations ne
// déclenchent qu'un seul jeu de requêtes.
async function DashboardWidgets() {
  const [formationData, profilData] = await Promise.all([
    getDashboardFormationData(),
    getDashboardProfilData(),
  ]);
  return (
    <>
      <FormationWidget data={formationData} />
      <ProfilWidget data={profilData} />
    </>
  );
}

export default async function DashboardPage() {
  // Seul le greeting est attendu pour le shell — il réutilise les lectures
  // mémoïsées du layout (quasi gratuit). Les widgets streament ensuite.
  const firstName = await getGreetingFirstName();
  return (
    <>
      <div className="nc-page-halo" style={{ minHeight: "100lvh" }}>
      <main style={{ position: "relative", zIndex: 1 }}>
        <ContentEnter
          style={{
            maxWidth: 1000,
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
                data-fb-label="Titre Salutation · Tableau de bord"
                style={{
                  fontSize: "clamp(32px, 4vw, 44px)",
                  fontWeight: 700,
                  letterSpacing: "-0.025em",
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
              data-fb-label="Barre de recherche · Tableau de bord"
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
              data-fb-label="Titre Salutation · Tableau de bord"
              style={{
                fontSize: "clamp(32px, 4vw, 44px)",
                fontWeight: 700,
                letterSpacing: "-0.025em",
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
            data-fb-label="Barre de recherche · Tableau de bord"
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
          <div
            data-fb-label="Grille de widgets · Tableau de bord"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Bannière en Suspense (fallback null) : async server component,
                elle ne doit PAS retenir le rendu du shell (greeting). Elle
                stream et n'apparaît que si l'email n'est pas confirmé. */}
            <Suspense fallback={null}>
              <EmailConfirmBanner />
            </Suspense>
            <Suspense
              fallback={
                <>
                  <WidgetCardSkeleton />
                  <WidgetCardSkeleton delay={80} />
                </>
              }
            >
              <DashboardWidgets />
            </Suspense>
          </div>
        </ContentEnter>
      </main>
      </div>
    </>
  );
}

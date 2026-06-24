import { DashboardSkeleton } from "@/shared/components/dashboard/DashboardSkeleton";

// Fallback du segment (app) — affiché pendant le chargement des données de page
// une fois le layout résolu. Le chrome (Topbar / BottomNav) est déjà monté par
// le layout → on ne squelette que le contenu (withChrome=false). Reproduit la
// homepage pour une transition sans saut, fond var(--color-surface-page).
export default function AppLoading() {
  return <DashboardSkeleton />;
}

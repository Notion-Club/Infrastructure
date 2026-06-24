import { DashboardSkeleton } from "@/shared/components/dashboard/DashboardSkeleton";

// Fallback du dashboard — affiché pendant le chargement des données de page
// (greeting + widgets) une fois le layout résolu. Le chrome est déjà monté par
// le layout → withChrome=false. Reproduit fidèlement la homepage (cartes
// widgets calquées sur FormationWidget/ProfilWidget) pour une transition sans
// saut, fond var(--color-surface-page) (light/dark).
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}

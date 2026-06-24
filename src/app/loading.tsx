import { DashboardSkeleton } from "@/shared/components/dashboard/DashboardSkeleton";

// Fallback racine — couvre la résolution du layout `(app)` (auth + profil),
// Server Component async sans frontière Suspense au-dessus de lui.
//
// On rend le squelette de la homepage DANS LE BON THÈME (la classe `.dark` est
// posée avant le 1er paint par le script inline du root layout). Par-dessus, le
// voile `.nc-splash-cover` reprend la couleur unique du splash natif iOS
// (#f5f2f2) puis se fond → transition fluide du splash vers light OU dark, sans
// saut de couleur, et sans dépendre de la sélection light/dark d'iOS (non
// fiable). Le voile n'est actif qu'en PWA standalone (cf. globals.css).
export default function RootLoading() {
  return (
    <>
      <DashboardSkeleton withChrome />
      <div className="nc-splash-cover" aria-hidden />
    </>
  );
}

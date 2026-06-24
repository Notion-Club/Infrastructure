import { DashboardSkeleton } from "@/shared/components/dashboard/DashboardSkeleton";

// Fallback racine — couvre la résolution du layout `(app)` (vérification auth
// Supabase + lecture profil), un Server Component async SANS frontière Suspense
// au-dessus de lui. Sans ce fichier, le navigateur ne reçoit rien tant que
// l'auth n'est pas résolue → écran vide au cold start (cf. PWA iOS).
//
// On reproduit la homepage (chrome Topbar/BottomNav + greeting + search +
// cartes widgets) plutôt qu'un spinner : la transition vers la page réelle est
// sans saut. Le fond suit `var(--color-surface-page)` (clair #f5f2f2 / sombre
// #141211), exactement comme in-app — la classe `.dark` est posée avant le 1er
// paint par le script inline du root layout.
//
// `withChrome` : le layout (app) n'a pas encore monté la Topbar / BottomNav à
// ce stade, donc on en dessine un squelette ici.
export default function RootLoading() {
  return <DashboardSkeleton withChrome />;
}

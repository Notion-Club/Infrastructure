// Fallback racine — couvre la résolution du layout `(app)` (vérification
// auth Supabase + lecture profil), qui est un Server Component async SANS
// frontière Suspense au-dessus de lui. Sans ce fichier, le navigateur ne
// reçoit RIEN tant que l'auth n'est pas résolue → écran blanc au cold start
// (cf. ouverture PWA iOS).
//
// Volontairement neutre (fond de marque + halo, pas de skeleton spécifique à
// une page) car il s'applique à toutes les routes. Sur iOS, il prend le
// relais du splash screen (même fond `--color-surface-page`) → transition
// sans flash blanc. Le skeleton détaillé du dashboard reste géré par
// `(app)/loading.tsx`, qui couvre le chargement des données de page une fois
// le layout résolu.
//
// `100lvh` (et non `dvh`) évite le re-measure de viewport iOS standalone au
// premier paint.
export default function RootLoading() {
  return (
    <div
      className="nc-page-halo"
      style={{
        minHeight: "100lvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-label="Chargement"
      role="status"
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 9999,
          border: "3px solid var(--color-border-default)",
          borderTopColor: "var(--color-brand)",
          animation: "nc-spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

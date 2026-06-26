import { notFound } from 'next/navigation';
import { ZoomLab } from './ZoomLab';

// Route lab DEV-ONLY — prototype de la zoom-transition /Ressources (Phase 1).
// Gated hors production : aucune surface de régression côté prod.
//
// GARDE : on bloque sur la BRANCHE de prod (`main`) via VERCEL_GIT_COMMIT_REF,
// PAS via VERCEL_ENV — cette dernière est forcée à "production" dans les env
// vars du projet (elle déclenchait un soft-404 jusque sur les previews). Le
// ref git du déploiement vaut "main" en prod et le nom de la branche en
// preview → la route reste invisible en prod, visible sur toute preview.
//
// PLACEMENT TEMPORAIRE : la route vit AU NIVEAU RACINE (hors du groupe `(app)`)
// pour rester accessible SANS login le temps de valider les previews — le
// layout `(app)` force l'auth Supabase (redirect /login). Le fond `.nc-app-bg`
// est conservé car il est monté dans le ROOT layout, pas dans `(app)`.
// → Après validation, remettre sous `src/app/(app)/lab/zoom` (auth réelle).
export default function ZoomLabPage() {
  if (process.env.VERCEL_GIT_COMMIT_REF === 'main') {
    notFound();
  }

  return (
    <div className="nc-page-halo" style={{ minHeight: '100lvh' }}>
      <ZoomLab />
    </div>
  );
}

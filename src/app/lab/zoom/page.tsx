import { notFound } from 'next/navigation';
import { ZoomLab } from './ZoomLab';

// Route lab DEV-ONLY — prototype de la zoom-transition /Ressources (Phase 1).
// Gated hors production : aucune surface de régression côté prod.
//
// PLACEMENT TEMPORAIRE : la route vit AU NIVEAU RACINE (hors du groupe `(app)`)
// pour rester accessible SANS login le temps de valider les previews — le
// layout `(app)` force l'auth Supabase (redirect /login). Le fond `.nc-app-bg`
// est conservé car il est monté dans le ROOT layout, pas dans `(app)`.
// → Après validation, remettre sous `src/app/(app)/lab/zoom` (auth réelle).
export default function ZoomLabPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }

  return (
    <div className="nc-page-halo" style={{ minHeight: '100lvh' }}>
      <ZoomLab />
    </div>
  );
}

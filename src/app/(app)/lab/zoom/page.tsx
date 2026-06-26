import { notFound } from 'next/navigation';
import { ZoomLab } from './ZoomLab';

// Route lab DEV-ONLY — prototype de la zoom-transition /Ressources (Phase 1).
// Gated hors production : aucune surface de régression côté prod.
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

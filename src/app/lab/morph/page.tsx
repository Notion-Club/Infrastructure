import { notFound } from 'next/navigation';
import { MorphTestHarness } from './MorphTestHarness';

// Route DEV-ONLY : monte la vraie mécanique de morph (MorphSourceProvider +
// cartes réelles ResourceCard/TemplateCard + ResourceMorphOverlay) sur des
// données MOCKÉES, pour le test e2e Playwright (`e2e/run-morph.mjs`).
//
// • Gatée hors production (même pattern que /lab/zoom) → zéro surface prod.
// • Hors du groupe (app) → pas de mur d'auth, pas de fetch Notion.
// Ainsi le test exerce le code réel de l'overlay sans dépendre du token Notion.
export default function MorphLabPage() {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }
  return <MorphTestHarness />;
}

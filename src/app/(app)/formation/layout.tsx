import type { ReactNode } from "react";
import { Suspense } from "react";

import { FormationToasts, LessonTransition } from "@/modules/formation";

// Layout de la section /formation/* — chrome standard de l'app.
// Les données viennent désormais de Supabase/Notion (plus de provider mock).

export default function FormationLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            className="px-4 pt-[96px] pb-[120px] md:px-10 md:pt-[148px] md:pb-12"
            style={{ maxWidth: 1100, margin: "0 auto" }}
          >
            {/* Transition leçon → leçon intégrée dans la colonne de contenu
                (masque l'ancien cours, héberge le feedback, révèle le nouveau). */}
            <LessonTransition>{children}</LessonTransition>
          </div>
        </main>
      </div>

      <Suspense fallback={null}>
        <FormationToasts />
      </Suspense>
    </>
  );
}

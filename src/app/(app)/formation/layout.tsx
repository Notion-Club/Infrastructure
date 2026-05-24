import type { ReactNode } from "react";
import { Suspense } from "react";

import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { FormationToasts } from "@/modules/formation";

// Layout de la section /formation/* — chrome standard de l'app.
// Les données viennent désormais de Supabase/Notion (plus de provider mock).

export default function FormationLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Fixed nav hors de nc-page-halo (isolation:isolate casse fixed) */}
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            className="px-4 pt-[96px] pb-[120px] md:px-10 md:pt-[148px] md:pb-12"
            style={{ maxWidth: 1100, margin: "0 auto" }}
          >
            <div className="nc-mode-in">{children}</div>
          </div>
        </main>
      </div>

      <Suspense fallback={null}>
        <FormationToasts />
      </Suspense>
    </>
  );
}

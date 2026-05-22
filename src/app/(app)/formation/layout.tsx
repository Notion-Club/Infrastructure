import type { ReactNode } from "react";

import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { FormationProvider } from "@/modules/formation";
import { DevToggle, DevModeBanner } from "@/modules/formation";

// Layout dédié à la section /formation/*. Server Component (par défaut)
// qui wrappe les enfants dans le FormationProvider client. Le provider
// porte le toggle dev + le state de progression mocké partagé entre les
// 3 pages (index, programme, leçon).
//
// Le DevToggle et le DevModeBanner sont rendus ici pour rester visibles
// quelle que soit la sous-route.

export default function FormationLayout({ children }: { children: ReactNode }) {
  return (
    <FormationProvider>
      {/* Fixed nav éléments — hors nc-page-halo pour éviter que
          isolation:isolate casse position:fixed */}
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        {/* Banner sticky au-dessus du contenu en dev / preview */}
        <div
          className="pt-[84px] md:pt-[88px]"
          style={{ position: "sticky", top: 0, zIndex: 39 }}
        >
          <DevModeBanner />
        </div>

        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            className="px-4 pt-6 pb-[120px] md:px-10 md:pt-8 md:pb-12"
            style={{ maxWidth: 1100, margin: "0 auto" }}
          >
            <div className="nc-mode-in">{children}</div>
          </div>
        </main>
      </div>

      <DevToggle />
    </FormationProvider>
  );
}

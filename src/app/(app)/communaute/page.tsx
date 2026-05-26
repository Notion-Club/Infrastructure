import type { Metadata } from "next";
import { Suspense } from "react";
import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { CommunityPageClient } from "./CommunityPageClient";

export const metadata: Metadata = {
  title: "Communauté — Notion Club",
};

export default function CommunautePage() {
  return (
    <>
      <Topbar />
      <div className="md:hidden">
        <MobileTopActions />
        <BottomNav />
      </div>

      <div className="nc-page-halo flex flex-col min-h-dvh md:h-dvh md:overflow-hidden">
        <main
          className="flex flex-col flex-1 min-h-0 w-full mx-auto px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[88px] md:pb-6"
          style={{ position: "relative", zIndex: 1, maxWidth: 840 }}
        >
          <Suspense fallback={null}>
            <CommunityPageClient />
          </Suspense>
        </main>
      </div>
    </>
  );
}

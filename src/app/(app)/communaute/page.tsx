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

      <div className="nc-page-halo" style={{ minHeight: "100dvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{ maxWidth: 840, margin: "0 auto" }}
            className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10"
          >
            <Suspense fallback={null}>
              <CommunityPageClient />
            </Suspense>
          </div>
        </main>
      </div>
    </>
  );
}

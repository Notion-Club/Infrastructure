import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Topbar } from "@/shared/components/dashboard/Topbar";
import { MobileTopActions } from "@/shared/components/dashboard/mobile/MobileTopActions";
import { BottomNav } from "@/shared/components/dashboard/mobile/BottomNav";
import { MOCK_POSTS } from "@/modules/community/mocks/posts.mock";
import { PostDetailClient } from "./PostDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = MOCK_POSTS.find((p) => p.id === id);
  return {
    title: post?.title ? `${post.title} — Communauté` : "Post — Communauté",
  };
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params;
  const post = MOCK_POSTS.find((p) => p.id === id);
  if (!post) notFound();

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
            <PostDetailClient post={post} />
          </div>
        </main>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostById, listCommentsForPost } from "@/modules/community/server/queries";
import { PostDetailClient } from "./PostDetailClient";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPostById(id);
  return {
    title: post?.title ? `${post.title} · Communauté` : "Post · Communauté",
  };
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params;
  // Post + commentaires en parallèle : listCommentsForPost ne dépend pas du
  // post (même id). getPostById est mémoïsé (cache()) → réutilise le fetch déjà
  // fait par generateMetadata, sans re-round-trip.
  const [post, comments] = await Promise.all([
    getPostById(id),
    listCommentsForPost(id),
  ]);
  if (!post) notFound();

  return (
    <div className="nc-page-halo" style={{ minHeight: "100lvh" }}>
        <main style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{ maxWidth: 840, margin: "0 auto" }}
            className="px-4 pt-[96px] pb-[100px] md:px-10 md:pt-[148px] md:pb-10"
          >
            <PostDetailClient post={post} initialComments={comments} />
          </div>
        </main>
    </div>
  );
}

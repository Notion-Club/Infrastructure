"use client";

import type { Post } from "@/modules/community/types/post.types";
import type { Comment } from "@/modules/community/types/comment.types";
import { CommunityPostDetailPage } from "@/modules/community/routes/community-post-detail-page";
import { useDevRoleToggle } from "@/modules/community/hooks/useDevRoleToggle";
import { DevRoleToggle } from "@/modules/community/components/dev/DevRoleToggle";

interface PostDetailClientProps {
  post: Post;
  initialComments: Comment[];
}

export function PostDetailClient({ post, initialComments }: PostDetailClientProps) {
  const { role, setRole, feedState, setFeedState } = useDevRoleToggle();

  return (
    <>
      <CommunityPostDetailPage
        post={post}
        initialComments={initialComments}
        devRole={role}
      />
      <DevRoleToggle
        role={role}
        onRoleChange={setRole}
        feedState={feedState}
        onFeedStateChange={setFeedState}
      />
    </>
  );
}

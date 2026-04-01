import { Loader } from "lucide-react";
import { Button } from "@redpulse/ui";
import { usePostsQuery, useToggleLikeMutation } from "./hooks";
import { PostCard } from "./post-card";

const WIN_FONT: React.CSSProperties = {
  fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif",
  fontSize: 11
};

type FeedListProps = {
  canLike: boolean;
  onRequireAuth?: () => void;
  onCreateFirstPost?: () => void;
  onOpenProfile?: (userId: string) => void;
};

export function FeedList({ canLike, onRequireAuth, onCreateFirstPost, onOpenProfile }: FeedListProps) {
  const postsQuery = usePostsQuery();
  const likeMutation = useToggleLikeMutation();

  if (postsQuery.isLoading) {
    return (
      <div className="win-sunken flex items-center gap-2 p-3">
        <Loader className="h-4 w-4 animate-spin text-[#0a246a]" />
        <span className="text-[11px] text-[#808080]" style={WIN_FONT}>Loading feed...</span>
      </div>
    );
  }

  if (postsQuery.isError) {
    return (
      <div className="win-sunken border-l-[3px] border-l-[#cc0000] p-2 text-[11px] text-[#cc0000]" style={WIN_FONT}>
        Feed error: {(postsQuery.error as Error).message || "Timeline could not be loaded."}
      </div>
    );
  }

  const items = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <div className="win-sunken p-3 text-center">
          <p className="text-[13px] font-bold text-black" style={WIN_FONT}>Feed is empty</p>
          <p className="mt-1 text-[11px] text-[#808080]" style={WIN_FONT}>
            No public posts yet. Once the first post appears, your timeline will come alive.
          </p>
          {onCreateFirstPost && (
            <div className="mt-3 flex justify-center gap-2">
              <Button size="sm" onClick={onCreateFirstPost}>Create first post</Button>
              <Button size="sm" variant="outline" onClick={() => postsQuery.refetch()}>Refresh</Button>
            </div>
          )}
        </div>
      ) : (
        items.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onLike={(postId) => likeMutation.mutate(postId)}
            liking={likeMutation.isPending && likeMutation.variables === post.id}
            canLike={canLike}
            onRequireAuth={onRequireAuth}
            onOpenProfile={onOpenProfile}
          />
        ))
      )}

      {postsQuery.hasNextPage && (
        <div className="flex justify-center pt-1">
          <Button variant="outline" size="sm" onClick={() => postsQuery.fetchNextPage()} disabled={postsQuery.isFetchingNextPage}>
            {postsQuery.isFetchingNextPage ? "Loading..." : "Load more posts"}
          </Button>
        </div>
      )}
    </div>
  );
}

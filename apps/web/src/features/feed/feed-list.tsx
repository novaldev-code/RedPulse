import { Sparkles } from "lucide-react";
import type { FeedScope } from "@redpulse/validation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@redpulse/ui";
import { useDeletePostMutation, usePostsQuery, useToggleLikeMutation, useToggleSaveMutation } from "./hooks";
import { PostCard } from "./post-card";

type FeedListProps = {
  scope: FeedScope;
  canLike: boolean;
  currentUserId?: string | null;
  onRequireAuth?: () => void;
  onCreateFirstPost?: () => void;
  onOpenExplore?: () => void;
  onOpenProfile?: (userId: string) => void;
};

export function FeedList({
  scope,
  canLike,
  currentUserId,
  onRequireAuth,
  onCreateFirstPost,
  onOpenExplore,
  onOpenProfile
}: FeedListProps) {
  const postsQuery = usePostsQuery(scope);
  const likeMutation = useToggleLikeMutation();
  const saveMutation = useToggleSaveMutation();
  const deleteMutation = useDeletePostMutation();

  if (postsQuery.isLoading) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Memuat feed...</CardTitle>
          <CardDescription>Mengambil update terbaru dari timeline RedPulse.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (postsQuery.isError) {
    return (
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Feed belum tersedia</CardTitle>
          <CardDescription>
            {(postsQuery.error as Error).message || "Timeline tidak bisa dimuat sekarang."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const items = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const isFollowingFeed = scope === "following";

  return (
    <div className="space-y-5">
      {items.length === 0 ? (
        <Card className="overflow-hidden bg-card">
          <CardHeader className="pb-3">
            <div className="animate-soft-float flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary shadow-[0_18px_40px_rgba(255,0,0,0.08)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-2 pt-3">
              <CardTitle className="text-[26px] font-black tracking-tight">
                {isFollowingFeed ? "Beranda Anda masih tenang" : "Feed masih tenang"}
              </CardTitle>
              <CardDescription className="max-w-lg text-sm leading-7 text-foreground/58">
                {isFollowingFeed
                  ? "Post di beranda hanya muncul dari akun yang Anda ikuti. Coba temukan orang terdekat dulu agar timeline terasa lebih personal."
                  : "Belum ada postingan publik. Begitu post pertama muncul, timeline ini akan langsung terasa hidup."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-[22px] bg-card/70 px-4 py-4 text-sm leading-7 text-foreground/58">
              {isFollowingFeed
                ? "Mulai follow akun yang relevan, lalu beranda Anda akan otomatis berubah jadi timeline yang lebih dekat dengan jaringan sendiri."
                : "Feed ini hanya menampilkan data nyata dari user. Tidak ada seed dummy yang menutupi pengalaman pertama Anda."}
            </div>
            {onCreateFirstPost || onOpenExplore ? (
              <div className="flex flex-wrap gap-3">
                {onCreateFirstPost ? (
                  <Button onClick={onCreateFirstPost}>
                    {isFollowingFeed ? "Buat post pertama" : "Buat post pertama"}
                  </Button>
                ) : null}
                {isFollowingFeed && onOpenExplore ? (
                  <Button variant="outline" onClick={onOpenExplore}>
                    Jelajahi akun
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => postsQuery.refetch()}>
                  Muat ulang feed
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        items.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onLike={(postId) => likeMutation.mutate(postId)}
            onSave={(postId) => saveMutation.mutate(postId)}
            liking={likeMutation.isPending && likeMutation.variables === post.id}
            saving={saveMutation.isPending && saveMutation.variables === post.id}
            isOwner={post.author.id === currentUserId}
            onDelete={(postId) => deleteMutation.mutate(postId)}
            deleting={deleteMutation.isPending && deleteMutation.variables === post.id}
            canLike={canLike}
            onRequireAuth={onRequireAuth}
            onOpenProfile={onOpenProfile}
          />
        ))
      )}

      {postsQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => postsQuery.fetchNextPage()} disabled={postsQuery.isFetchingNextPage}>
            {postsQuery.isFetchingNextPage ? "Memuat lagi..." : "Lihat post lainnya"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

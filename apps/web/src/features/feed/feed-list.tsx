import { Sparkles } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@redpulse/ui";
import { usePostsQuery, useToggleLikeMutation } from "./hooks";
import { PostCard } from "./post-card";

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
      <Card className="bg-[#090909]">
        <CardHeader>
          <CardTitle>Memuat feed...</CardTitle>
          <CardDescription>Mengambil update terbaru dari timeline RedPulse.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (postsQuery.isError) {
    return (
      <Card className="bg-[#090909]">
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

  return (
    <div className="space-y-5">
      {items.length === 0 ? (
        <Card className="overflow-hidden bg-[#090909]">
          <CardHeader className="pb-3">
            <div className="animate-soft-float flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-primary shadow-[0_18px_40px_rgba(255,0,0,0.08)]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-2 pt-3">
              <CardTitle className="text-[26px] font-black tracking-tight">Feed masih tenang</CardTitle>
              <CardDescription className="max-w-lg text-sm leading-7 text-white/58">
                Belum ada postingan publik. Begitu post pertama muncul, timeline ini akan langsung terasa hidup.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-[22px] bg-white/[0.03] px-4 py-4 text-sm leading-7 text-white/58">
              Feed ini hanya menampilkan data nyata dari user. Tidak ada seed dummy yang menutupi pengalaman pertama Anda.
            </div>
            {onCreateFirstPost ? (
              <div className="flex flex-wrap gap-3">
                <Button onClick={onCreateFirstPost}>Buat post pertama</Button>
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
            onLike={(postId) => likeMutation.mutate(postId)}
            liking={likeMutation.isPending && likeMutation.variables === post.id}
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

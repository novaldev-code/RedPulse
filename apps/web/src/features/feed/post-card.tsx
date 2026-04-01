import { useEffect, useState } from "react";
import { Bookmark, Heart, MapPin, MessageCircle, SendHorizontal } from "lucide-react";
import type { FeedPost } from "@redpulse/validation";
import { Button, Card, CardContent, CardFooter, CardHeader, cn } from "@redpulse/ui";
import { ApiError } from "../../lib/api";
import { useCommentsQuery, useCreateCommentMutation } from "./hooks";

type PostCardProps = {
  post: FeedPost;
  onLike: (postId: string) => void;
  liking: boolean;
  canLike: boolean;
  onRequireAuth?: () => void;
  onOpenProfile?: (userId: string) => void;
};

function getRelativePostTime(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function PostCard({ post, onLike, liking, canLike, onRequireAuth, onOpenProfile }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const commentsQuery = useCommentsQuery(post.id, showComments);
  const createCommentMutation = useCreateCommentMutation(post.id);

  useEffect(() => {
    if (!shareFeedback) {
      return;
    }

    const timeout = window.setTimeout(() => setShareFeedback(null), 2400);

    return () => window.clearTimeout(timeout);
  }, [shareFeedback]);

  async function handleShare() {
    const shareUrl = `${window.location.origin}/?post=${post.id}`;
    const shareText = [post.content, post.location ? `Lokasi: ${post.location}` : null].filter(Boolean).join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post dari @${post.author.username}`,
          text: shareText || `Lihat post terbaru dari @${post.author.username} di RedPulse`,
          url: shareUrl
        });
        setShareFeedback("Sheet share sudah dibuka.");
        return;
      }

      await navigator.clipboard.writeText(`${shareText ? `${shareText}\n` : ""}${shareUrl}`);
      setShareFeedback("Link post disalin.");
    } catch {
      setShareFeedback("Share belum berhasil. Coba lagi.");
    }
  }

  return (
    <Card className="overflow-hidden rounded-[22px] border-border bg-card p-0 shadow-[0_14px_34px_rgba(0,0,0,0.14)] md:rounded-[30px] md:shadow-[0_16px_44px_rgba(0,0,0,0.18)]">
      <CardHeader className="gap-3 px-3.5 pb-3 pt-3.5 md:gap-4 md:px-5 md:pb-4 md:pt-5">
        <div className="flex items-center gap-3">
          <button className="shrink-0" onClick={() => onOpenProfile?.(post.author.id)} type="button">
            {post.author.avatarUrl ? (
              <img
                alt={post.author.username}
                className="h-10 w-10 rounded-full border border-border object-cover md:h-11 md:w-11"
                src={post.author.avatarUrl}
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-bold text-primary md:h-11 md:w-11">
                {post.author.username.slice(0, 2).toUpperCase()}
              </div>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="text-[15px] font-bold tracking-tight text-foreground transition hover:text-primary"
                onClick={() => onOpenProfile?.(post.author.id)}
                type="button"
              >
                {post.author.username}
              </button>
              <span className="text-xs text-foreground/22">•</span>
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-foreground/38">
                {getRelativePostTime(post.createdAt)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/28">
              <span>{post.type}</span>
              {post.location ? (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal text-foreground/42">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {post.location}
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <button
            className="rounded-full px-2 py-1 text-foreground/45 transition hover:bg-foreground/5 hover:text-foreground"
            type="button"
          >
            ...
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-0 px-3.5 pt-0 md:px-5">
        {post.media.length > 0 ? (
          <div className="grid gap-2.5 border-y border-border py-3.5 md:gap-3 md:py-5">
            {post.media.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-[20px] border border-border bg-background md:rounded-[24px]">
                {item.type === "video" ? (
                  <video className="max-h-[540px] w-full object-cover" controls playsInline preload="metadata" src={item.url} />
                ) : (
                  <img alt={post.content ?? `${post.author.username} media`} className="max-h-[540px] w-full object-cover" src={item.url} />
                )}
              </div>
            ))}
          </div>
        ) : null}
        {post.content ? (
          <div className="border-b border-border py-3.5 md:py-5">
            <p className="text-pretty text-[14px] leading-6 text-foreground/88 md:text-[15px] md:leading-7">{post.content}</p>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3 px-3.5 pb-3.5 pt-3.5 md:px-5 md:pb-5 md:pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              className={cn(
                "rounded-full p-2 text-foreground/82 transition duration-200 hover:scale-105 hover:bg-foreground/5 active:scale-95",
                post.likedByMe && "animate-soft-pulse bg-primary/10 text-primary shadow-[0_8px_20px_rgba(255,0,0,0.14)]"
              )}
              disabled={liking}
              onClick={() => {
                if (!canLike) {
                  onRequireAuth?.();
                  return;
                }

                onLike(post.id);
              }}
              type="button"
            >
              <Heart className={cn("h-5 w-5", post.likedByMe && "fill-current")} />
            </button>
            <button
              className={cn(
                "rounded-full p-2 text-foreground/72 transition duration-200 hover:scale-105 hover:bg-foreground/5 hover:text-foreground active:scale-95",
                showComments && "bg-foreground/6 text-foreground"
              )}
              onClick={() => setShowComments((current) => !current)}
              type="button"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <button
              className="rounded-full p-2 text-foreground/72 transition duration-200 hover:scale-105 hover:bg-foreground/5 hover:text-foreground active:scale-95"
              onClick={() => {
                void handleShare();
              }}
              type="button"
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </div>
          <button className="rounded-full p-2 text-foreground/72 transition duration-200 hover:scale-105 hover:bg-foreground/5 hover:text-foreground active:scale-95" type="button">
            <Bookmark className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1 px-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-sm font-bold text-foreground">{post.likeCount} Pulse</p>
            <button
              className="text-sm font-semibold text-foreground/62 transition hover:text-foreground"
              onClick={() => setShowComments(true)}
              type="button"
            >
              {post.commentCount} komentar
            </button>
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/32">
            {canLike ? "Interaksi aktif untuk like, komentar, dan share" : "Login untuk memberi Pulse dan komentar"}
          </p>
          {shareFeedback ? <p className="text-xs font-medium text-primary">{shareFeedback}</p> : null}
        </div>

        {showComments ? (
          <div className="space-y-4 rounded-[18px] border border-border bg-background/65 p-3.5 md:rounded-[22px] md:p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Komentar</p>
                <p className="text-xs text-foreground/45">Balasan tersimpan sebagai thread reply di database.</p>
              </div>
              <button
                className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/35 transition hover:text-foreground"
                onClick={() => setShowComments(false)}
                type="button"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3">
              {commentsQuery.isLoading ? (
                <p className="text-sm text-foreground/55">Memuat komentar...</p>
              ) : commentsQuery.data?.comments.length ? (
                commentsQuery.data.comments.map((comment) => (
                  <div key={comment.id} className="rounded-[18px] border border-border bg-card/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">@{comment.author.username}</p>
                        <p className="mt-1 text-xs text-foreground/40">{getRelativePostTime(comment.createdAt)}</p>
                      </div>
                      <span className="text-xs font-medium text-foreground/36">{comment.likeCount} Pulse</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-foreground/82">{comment.content ?? ""}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-border bg-card/70 px-4 py-4 text-sm leading-7 text-foreground/55">
                  Belum ada komentar. Jadilah orang pertama yang membuka percakapan di post ini.
                </div>
              )}
            </div>

            {canLike ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();

                  const content = commentDraft.trim();
                  if (!content) {
                    setCommentError("Komentar tidak boleh kosong.");
                    return;
                  }

                  setCommentError(null);
                  createCommentMutation.mutate(
                    { content },
                    {
                      onSuccess: () => {
                        setCommentDraft("");
                      },
                      onError: (error) => {
                        if (error instanceof ApiError) {
                          setCommentError(error.message);
                          return;
                        }

                        setCommentError("Komentar belum berhasil dikirim.");
                      }
                    }
                  );
                }}
              >
                <textarea
                  className="min-h-24 w-full rounded-[18px] border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-foreground/35 focus:border-primary/30 focus:bg-card"
                  maxLength={220}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder="Tulis komentar yang relevan dan bikin percakapan hidup..."
                  value={commentDraft}
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs uppercase tracking-[0.18em] text-foreground/35">{commentDraft.length}/220</span>
                  <Button className="rounded-full px-5" disabled={createCommentMutation.isPending} type="submit">
                    {createCommentMutation.isPending ? "Mengirim..." : "Kirim komentar"}
                  </Button>
                </div>
                {commentError ? <p className="text-sm text-red-500">{commentError}</p> : null}
              </form>
            ) : (
              <div className="space-y-3 rounded-[18px] border border-border bg-card/70 px-4 py-4">
                <p className="text-sm text-foreground/62">Login dulu supaya Anda bisa ikut komentar di post ini.</p>
                <Button variant="outline" onClick={() => onRequireAuth?.()}>
                  Buka login
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}

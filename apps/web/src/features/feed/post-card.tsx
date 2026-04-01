import { useEffect, useState } from "react";
import { Bookmark, Heart, MapPin, MessageCircle, SendHorizontal } from "lucide-react";
import type { FeedPost } from "@redpulse/validation";
import { Button, cn } from "@redpulse/ui";
import { ApiError } from "../../lib/api";
import { useCommentsQuery, useCreateCommentMutation } from "./hooks";

const WIN_FONT: React.CSSProperties = {
  fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif",
  fontSize: 11
};

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
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function PostCard({ post, onLike, liking, canLike, onRequireAuth, onOpenProfile }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const commentsQuery = useCommentsQuery(post.id, showComments);
  const createCommentMutation = useCreateCommentMutation(post.id);

  useEffect(() => {
    if (!shareFeedback) return;
    const timeout = window.setTimeout(() => setShareFeedback(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [shareFeedback]);

  async function handleShare() {
    const shareUrl = `${window.location.origin}/?post=${post.id}`;
    const shareText = [post.content, post.location ? `Location: ${post.location}` : null].filter(Boolean).join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: `Post by @${post.author.username}`, text: shareText || `See this post by @${post.author.username} on RedPulse`, url: shareUrl });
        setShareFeedback("Share dialog opened.");
        return;
      }
      await navigator.clipboard.writeText(`${shareText ? `${shareText}\n` : ""}${shareUrl}`);
      setShareFeedback("Link copied.");
    } catch {
      setShareFeedback("Share failed. Try again.");
    }
  }

  return (
    /* Win2K window */
    <div className="win-window overflow-hidden">
      {/* title bar */}
      <div className="win-titlebar">
        <button
          className="shrink-0"
          onClick={() => onOpenProfile?.(post.author.id)}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          type="button"
        >
          {post.author.avatarUrl ? (
            <img alt={post.author.username} className="h-4 w-4 object-cover" src={post.author.avatarUrl} />
          ) : (
            <div className="flex h-4 w-4 items-center justify-center bg-white/20 text-[8px] font-bold text-white">
              {post.author.username.slice(0, 2).toUpperCase()}
            </div>
          )}
        </button>
        <button
          className="truncate text-[11px] font-bold text-white hover:underline"
          onClick={() => onOpenProfile?.(post.author.id)}
          style={{ ...WIN_FONT, background: "none", border: "none", cursor: "pointer" }}
          type="button"
        >
          @{post.author.username}
        </button>
        <span className="ml-1 text-[10px] text-white/70" style={WIN_FONT}>{getRelativePostTime(post.createdAt)}</span>
        {post.location && (
          <span className="ml-2 flex items-center gap-1 text-[10px] text-white/70" style={WIN_FONT}>
            <MapPin className="h-3 w-3" />{post.location}
          </span>
        )}
        {/* fake window buttons */}
        <div className="ml-auto flex gap-[2px]">
          {["_", "□", "✕"].map((lbl) => (
            <button
              key={lbl}
              className="win-raised flex h-[14px] w-[16px] items-center justify-center text-[9px] text-black"
              style={{ fontFamily: "Marlett, sans-serif", lineHeight: 1 }}
              type="button"
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* body */}
      <div className="p-2 space-y-2">
        {/* media */}
        {post.media.length > 0 && (
          <div className="space-y-1">
            {post.media.map((item) => (
              <div key={item.id} className="win-sunken overflow-hidden">
                {item.type === "video" ? (
                  <video className="max-h-[400px] w-full object-cover" controls playsInline preload="metadata" src={item.url} />
                ) : (
                  <img alt={post.content ?? `${post.author.username} media`} className="max-h-[400px] w-full object-cover" src={item.url} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* content */}
        {post.content && (
          <p className="text-[11px] leading-5 text-black" style={WIN_FONT}>{post.content}</p>
        )}

        {/* action toolbar */}
        <div className="win-separator" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {/* like */}
            <button
              className={cn("win-toolbar-btn flex items-center gap-1 text-[11px]", post.likedByMe ? "text-[#cc0000]" : "text-black")}
              disabled={liking}
              onClick={() => { if (!canLike) { onRequireAuth?.(); return; } onLike(post.id); }}
              style={WIN_FONT}
              type="button"
            >
              <Heart className={cn("h-3.5 w-3.5", post.likedByMe && "fill-current")} />
              <span>{post.likeCount} Pulse</span>
            </button>
            {/* comment */}
            <button
              className={cn("win-toolbar-btn flex items-center gap-1 text-[11px]", showComments ? "win-pressed" : "text-black")}
              onClick={() => setShowComments((v) => !v)}
              style={WIN_FONT}
              type="button"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{post.commentCount}</span>
            </button>
            {/* share */}
            <button
              className="win-toolbar-btn flex items-center gap-1 text-[11px] text-black"
              onClick={() => void handleShare()}
              style={WIN_FONT}
              type="button"
            >
              <SendHorizontal className="h-3.5 w-3.5" />
              Share
            </button>
          </div>
          <button className="win-toolbar-btn text-[11px] text-black" style={WIN_FONT} type="button">
            <Bookmark className="h-3.5 w-3.5" />
          </button>
        </div>

        {shareFeedback && (
          <p className="text-[10px] text-[#0000cc]" style={WIN_FONT}>{shareFeedback}</p>
        )}

        {/* comments panel */}
        {showComments && (
          <div className="win-sunken space-y-2 p-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-black" style={WIN_FONT}>Comments</span>
              <button
                className="text-[10px] text-[#0000cc] hover:underline"
                onClick={() => setShowComments(false)}
                style={WIN_FONT}
                type="button"
              >
                Close
              </button>
            </div>

            {commentsQuery.isLoading ? (
              <p className="text-[11px] text-[#808080]" style={WIN_FONT}>Loading comments...</p>
            ) : commentsQuery.data?.comments.length ? (
              commentsQuery.data.comments.map((comment) => (
                <div key={comment.id} className="win-raised p-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-black" style={WIN_FONT}>@{comment.author.username}</span>
                    <span className="text-[10px] text-[#808080]" style={WIN_FONT}>{getRelativePostTime(comment.createdAt)} · {comment.likeCount} Pulse</span>
                  </div>
                  <p className="mt-1 text-[11px] text-black" style={WIN_FONT}>{comment.content ?? ""}</p>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-[#808080]" style={WIN_FONT}>No comments yet. Be the first to comment.</p>
            )}

            {canLike ? (
              <form
                className="space-y-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const content = commentDraft.trim();
                  if (!content) { setCommentError("Comment cannot be empty."); return; }
                  setCommentError(null);
                  createCommentMutation.mutate(
                    { content },
                    {
                      onSuccess: () => setCommentDraft(""),
                      onError: (err) => setCommentError(err instanceof ApiError ? err.message : "Failed to post comment.")
                    }
                  );
                }}
              >
                <textarea
                  className="win-sunken w-full resize-none p-1.5 text-[11px] text-black"
                  maxLength={220}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder="Write a comment..."
                  rows={3}
                  style={WIN_FONT}
                  value={commentDraft}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#808080]" style={WIN_FONT}>{commentDraft.length}/220</span>
                  <Button size="sm" disabled={createCommentMutation.isPending} type="submit">
                    {createCommentMutation.isPending ? "Sending..." : "OK"}
                  </Button>
                </div>
                {commentError && <p className="text-[10px] text-[#cc0000]" style={WIN_FONT}>{commentError}</p>}
              </form>
            ) : (
              <div className="space-y-1">
                <p className="text-[11px] text-[#808080]" style={WIN_FONT}>Sign in to leave a comment.</p>
                <Button size="sm" variant="outline" onClick={() => onRequireAuth?.()}>Sign in</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

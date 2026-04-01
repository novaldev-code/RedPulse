import { z } from "zod";

export const feedQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10)
});

export const createPostSchema = z.object({
  content: z
    .string()
    .trim()
    .max(280, "Post content must be 280 characters or fewer.")
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      return value.length > 0 ? value : undefined;
    }),
  location: z
    .string()
    .trim()
    .max(160, "Location must be 160 characters or fewer.")
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      return value.length > 0 ? value : undefined;
    })
});

export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment content is required.")
    .max(220, "Comment content must be 220 characters or fewer.")
});

export const postMediaSchema = z.object({
  id: z.uuid(),
  url: z.string().url(),
  type: z.enum(["image", "video"]),
  sortOrder: z.number().int().nonnegative()
});

export const postAuthorSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  avatarUrl: z.string().nullable()
});

export const profileSummarySchema = z.object({
  id: z.uuid(),
  username: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  createdAt: z.string(),
  postsCount: z.number().int().nonnegative(),
  followersCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative()
});

export const currentProfileResponseSchema = z.object({
  profile: profileSummarySchema
});

export const publicProfileSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  createdAt: z.string(),
  postsCount: z.number().int().nonnegative(),
  followersCount: z.number().int().nonnegative(),
  followingCount: z.number().int().nonnegative(),
  isFollowing: z.boolean()
});

export const suggestedUserSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  followersCount: z.number().int().nonnegative(),
  postsCount: z.number().int().nonnegative(),
  isFollowing: z.boolean()
});

export const suggestedUsersResponseSchema = z.object({
  users: z.array(suggestedUserSchema)
});

export const feedPostSchema = z.object({
  id: z.uuid(),
  content: z.string().nullable(),
  location: z.string().nullable(),
  type: z.enum(["post", "reply", "repost"]),
  createdAt: z.string(),
  likeCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  likedByMe: z.boolean(),
  media: z.array(postMediaSchema),
  author: postAuthorSchema
});

export const feedResponseSchema = z.object({
  items: z.array(feedPostSchema),
  nextCursor: z.string().nullable()
});

export const createPostResponseSchema = z.object({
  post: feedPostSchema
});

export const publicProfileResponseSchema = z.object({
  profile: publicProfileSchema,
  posts: z.array(feedPostSchema)
});

export const toggleLikeParamsSchema = z.object({
  id: z.uuid()
});

export const postCommentsParamsSchema = z.object({
  id: z.uuid()
});

export const postCommentsResponseSchema = z.object({
  comments: z.array(feedPostSchema)
});

export const createCommentResponseSchema = z.object({
  comment: feedPostSchema
});

export const toggleLikeResponseSchema = z.object({
  postId: z.uuid(),
  likedByMe: z.boolean(),
  likeCount: z.number().int().nonnegative()
});

export const toggleFollowParamsSchema = z.object({
  id: z.uuid()
});

export const toggleFollowResponseSchema = z.object({
  userId: z.uuid(),
  isFollowing: z.boolean(),
  followersCount: z.number().int().nonnegative()
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type PostMedia = z.infer<typeof postMediaSchema>;
export type FeedPost = z.infer<typeof feedPostSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;
export type PostCommentsResponse = z.infer<typeof postCommentsResponseSchema>;
export type CreateCommentResponse = z.infer<typeof createCommentResponseSchema>;
export type ProfileSummary = z.infer<typeof profileSummarySchema>;
export type CurrentProfileResponse = z.infer<typeof currentProfileResponseSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;
export type SuggestedUser = z.infer<typeof suggestedUserSchema>;
export type SuggestedUsersResponse = z.infer<typeof suggestedUsersResponseSchema>;
export type ToggleLikeParams = z.infer<typeof toggleLikeParamsSchema>;
export type PostCommentsParams = z.infer<typeof postCommentsParamsSchema>;
export type ToggleLikeResponse = z.infer<typeof toggleLikeResponseSchema>;
export type ToggleFollowParams = z.infer<typeof toggleFollowParamsSchema>;
export type ToggleFollowResponse = z.infer<typeof toggleFollowResponseSchema>;

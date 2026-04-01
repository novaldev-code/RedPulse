import { z } from "zod";

export const feedScopeSchema = z.enum(["following", "global"]);

export const feedQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
  scope: feedScopeSchema.default("global")
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
  mutualCount: z.number().int().nonnegative(),
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
  savedByMe: z.boolean(),
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

export const commentParamsSchema = z.object({
  id: z.uuid()
});

export const deletePostParamsSchema = z.object({
  id: z.uuid()
});

export const postCommentsResponseSchema = z.object({
  comments: z.array(feedPostSchema)
});

export const createCommentResponseSchema = z.object({
  comment: feedPostSchema
});

export const updateCommentResponseSchema = z.object({
  comment: feedPostSchema
});

export const toggleLikeResponseSchema = z.object({
  postId: z.uuid(),
  likedByMe: z.boolean(),
  likeCount: z.number().int().nonnegative()
});

export const toggleSaveResponseSchema = z.object({
  postId: z.uuid(),
  savedByMe: z.boolean()
});

export const deletePostResponseSchema = z.object({
  postId: z.uuid()
});

export const deleteCommentResponseSchema = z.object({
  commentId: z.uuid(),
  postId: z.uuid()
});

export const toggleFollowParamsSchema = z.object({
  id: z.uuid()
});

export const toggleFollowResponseSchema = z.object({
  userId: z.uuid(),
  isFollowing: z.boolean(),
  followersCount: z.number().int().nonnegative()
});

export const conversationParticipantSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable()
});

export const notificationTypeSchema = z.enum(["follow", "message", "like", "comment", "post"]);

export const notificationActorSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  avatarUrl: z.string().nullable()
});

export const notificationSchema = z.object({
  id: z.uuid(),
  type: notificationTypeSchema,
  entityId: z.uuid().nullable(),
  message: z.string(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
  actor: notificationActorSchema.nullable()
});

export const notificationsResponseSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative()
});

export const markNotificationsReadResponseSchema = z.object({
  success: z.boolean(),
  unreadCount: z.number().int().nonnegative()
});

export const directMessageSchema = z.object({
  id: z.uuid(),
  content: z.string(),
  createdAt: z.string(),
  senderId: z.uuid(),
  sender: conversationParticipantSchema
});

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  participant: conversationParticipantSchema,
  lastMessage: directMessageSchema.nullable(),
  updatedAt: z.string()
});

export const conversationsResponseSchema = z.object({
  conversations: z.array(conversationSummarySchema)
});

export const conversationMessagesParamsSchema = z.object({
  id: z.uuid()
});

export const conversationMessagesResponseSchema = z.object({
  conversation: conversationSummarySchema,
  messages: z.array(directMessageSchema)
});

export const sendDirectMessageParamsSchema = z.object({
  userId: z.uuid()
});

export const sendDirectMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message content is required.")
    .max(1000, "Message content must be 1000 characters or fewer.")
});

export const sendDirectMessageResponseSchema = z.object({
  conversation: conversationSummarySchema,
  message: directMessageSchema
});

export const savedPostsResponseSchema = z.object({
  items: z.array(feedPostSchema)
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
export type FeedScope = z.infer<typeof feedScopeSchema>;
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CommentParams = z.infer<typeof commentParamsSchema>;
export type PostMedia = z.infer<typeof postMediaSchema>;
export type FeedPost = z.infer<typeof feedPostSchema>;
export type FeedResponse = z.infer<typeof feedResponseSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;
export type PostCommentsResponse = z.infer<typeof postCommentsResponseSchema>;
export type CreateCommentResponse = z.infer<typeof createCommentResponseSchema>;
export type UpdateCommentResponse = z.infer<typeof updateCommentResponseSchema>;
export type ProfileSummary = z.infer<typeof profileSummarySchema>;
export type CurrentProfileResponse = z.infer<typeof currentProfileResponseSchema>;
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;
export type SuggestedUser = z.infer<typeof suggestedUserSchema>;
export type SuggestedUsersResponse = z.infer<typeof suggestedUsersResponseSchema>;
export type ToggleLikeParams = z.infer<typeof toggleLikeParamsSchema>;
export type PostCommentsParams = z.infer<typeof postCommentsParamsSchema>;
export type DeletePostParams = z.infer<typeof deletePostParamsSchema>;
export type ToggleLikeResponse = z.infer<typeof toggleLikeResponseSchema>;
export type ToggleSaveResponse = z.infer<typeof toggleSaveResponseSchema>;
export type DeletePostResponse = z.infer<typeof deletePostResponseSchema>;
export type DeleteCommentResponse = z.infer<typeof deleteCommentResponseSchema>;
export type ToggleFollowParams = z.infer<typeof toggleFollowParamsSchema>;
export type ToggleFollowResponse = z.infer<typeof toggleFollowResponseSchema>;
export type ConversationParticipant = z.infer<typeof conversationParticipantSchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationActor = z.infer<typeof notificationActorSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;
export type MarkNotificationsReadResponse = z.infer<typeof markNotificationsReadResponseSchema>;
export type DirectMessage = z.infer<typeof directMessageSchema>;
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;
export type ConversationsResponse = z.infer<typeof conversationsResponseSchema>;
export type ConversationMessagesParams = z.infer<typeof conversationMessagesParamsSchema>;
export type ConversationMessagesResponse = z.infer<typeof conversationMessagesResponseSchema>;
export type SendDirectMessageParams = z.infer<typeof sendDirectMessageParamsSchema>;
export type SendDirectMessageInput = z.infer<typeof sendDirectMessageSchema>;
export type SendDirectMessageResponse = z.infer<typeof sendDirectMessageResponseSchema>;
export type SavedPostsResponse = z.infer<typeof savedPostsResponseSchema>;

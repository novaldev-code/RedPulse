import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import type {
  ConversationMessagesResponse,
  ConversationsResponse,
  CreateCommentInput,
  MarkNotificationsReadResponse,
  NotificationsResponse,
  PostCommentsResponse,
  CurrentProfileResponse,
  FeedResponse,
  FeedScope,
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  SavedPostsResponse,
  SendDirectMessageInput,
  SafeUser,
  UpdateProfileInput,
  SuggestedUsersResponse
} from "@redpulse/validation";
import {
  getConversationMessages,
  getConversations,
  createComment,
  createPost,
  deleteComment,
  deletePost,
  getComments,
  getCurrentUser,
  getGoogleConfig,
  getNotifications,
  getPosts,
  getPublicProfile,
  getProfileSummary,
  getSavedPosts,
  getSuggestedUsers,
  loginUser,
  loginWithGoogle,
  markNotificationsRead,
  logoutUser,
  registerUser,
  sendDirectMessage,
  toggleFollow,
  toggleLike,
  toggleSave,
  updateComment,
  updateProfile
} from "./api";
import type { CreatePostPayload } from "./api";

type FeedItem = FeedResponse["items"][number];

export const postsQueryKey = ["posts"] as const;
export const postsFeedQueryKey = (scope: FeedScope) => [...postsQueryKey, scope] as const;
export const commentsQueryKey = (postId: string) => ["comments", postId] as const;
export const currentUserQueryKey = ["current-user"] as const;
export const profileSummaryQueryKey = ["profile-summary"] as const;
export const publicProfileQueryKey = (userId: string) => ["public-profile", userId] as const;
export const suggestedUsersQueryKey = ["suggested-users"] as const;
export const googleConfigQueryKey = ["google-config"] as const;
export const conversationsQueryKey = ["conversations"] as const;
export const conversationMessagesQueryKey = (conversationId: string) => ["conversation-messages", conversationId] as const;
export const notificationsQueryKey = ["notifications"] as const;
export const savedPostsQueryKey = ["saved-posts"] as const;

function getPreviousFeedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.getQueriesData<InfiniteData<FeedResponse>>({ queryKey: postsQueryKey });
}

function restorePreviousFeedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  previousFeeds: Array<[QueryKey, InfiniteData<FeedResponse> | undefined]>,
) {
  for (const [queryKey, data] of previousFeeds) {
    queryClient.setQueryData(queryKey, data);
  }
}

function updateFeedQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (current: InfiniteData<FeedResponse>) => InfiniteData<FeedResponse>,
) {
  queryClient.setQueriesData<InfiniteData<FeedResponse>>(
    { queryKey: postsQueryKey },
    (current) => {
      if (!current) {
        return current;
      }

      return updater(current);
    },
  );
}

export function usePostsQuery(scope: FeedScope, enabled = true) {
  return useInfiniteQuery({
    queryKey: postsFeedQueryKey(scope),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getPosts(pageParam, scope),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled
  });
}

export function useCurrentUserQuery() {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: getCurrentUser,
    retry: false
  });
}

export function useCommentsQuery(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: commentsQueryKey(postId),
    queryFn: () => getComments(postId),
    enabled
  });
}

export function useProfileSummaryQuery(enabled: boolean) {
  return useQuery({
    queryKey: profileSummaryQueryKey,
    queryFn: getProfileSummary,
    enabled,
    retry: false
  });
}

export function usePublicProfileQuery(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: userId ? publicProfileQueryKey(userId) : ["public-profile", "idle"],
    queryFn: () => getPublicProfile(userId!),
    enabled: enabled && Boolean(userId),
    retry: false
  });
}

export function useSuggestedUsersQuery(enabled: boolean) {
  return useQuery({
    queryKey: suggestedUsersQueryKey,
    queryFn: getSuggestedUsers,
    enabled,
    retry: false
  });
}

export function useGoogleConfigQuery(enabled: boolean) {
  return useQuery({
    queryKey: googleConfigQueryKey,
    queryFn: getGoogleConfig,
    enabled,
    retry: false
  });
}

export function useConversationsQuery(enabled: boolean, isActive = false) {
  return useQuery({
    queryKey: conversationsQueryKey,
    queryFn: getConversations,
    enabled,
    retry: false,
    refetchInterval: enabled ? (isActive ? 8000 : 30000) : false
  });
}

export function useConversationMessagesQuery(conversationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: conversationId ? conversationMessagesQueryKey(conversationId) : ["conversation-messages", "idle"],
    queryFn: () => getConversationMessages(conversationId!),
    enabled: enabled && Boolean(conversationId),
    retry: false,
    refetchInterval: enabled && Boolean(conversationId) ? 5000 : false
  });
}

export function useNotificationsQuery(enabled: boolean, isActive = false) {
  return useQuery({
    queryKey: notificationsQueryKey,
    queryFn: getNotifications,
    enabled,
    retry: false,
    refetchInterval: enabled ? (isActive ? 10000 : 30000) : false
  });
}

export function useSavedPostsQuery(enabled: boolean) {
  return useQuery({
    queryKey: savedPostsQueryKey,
    queryFn: getSavedPosts,
    enabled,
    retry: false
  });
}

export function useToggleLikeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleLike,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postsQueryKey });

      const previousFeeds = getPreviousFeedQueries(queryClient);

      updateFeedQueries(queryClient, (current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  likedByMe: !item.likedByMe,
                  likeCount: Math.max(0, item.likeCount + (item.likedByMe ? -1 : 1))
                }
              : item
          )
        }))
      }));

      return { previousFeeds };
    },
    onError: (_error, _postId, context) => {
      if (context?.previousFeeds) {
        restorePreviousFeedQueries(queryClient, context.previousFeeds);
      }
    },
    onSuccess: (result) => {
      updateFeedQueries(queryClient, (current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === result.postId
              ? {
                  ...item,
                  likedByMe: result.likedByMe,
                  likeCount: result.likeCount
                }
              : item
          )
        }))
      }));
    }
  });
}

export function useToggleSaveMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleSave,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postsQueryKey });
      await queryClient.cancelQueries({ queryKey: savedPostsQueryKey });

      const previousFeeds = getPreviousFeedQueries(queryClient);
      const previousSavedPosts = queryClient.getQueryData<SavedPostsResponse>(savedPostsQueryKey);

      let toggledItem: FeedItem | undefined;

      updateFeedQueries(queryClient, (current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => {
            if (item.id !== postId) {
              return item;
            }

            toggledItem = {
              ...item,
              savedByMe: !item.savedByMe
            };

            return toggledItem;
          })
        }))
      }));

      if (toggledItem) {
        const nextToggledItem = toggledItem;

        queryClient.setQueryData<SavedPostsResponse | undefined>(savedPostsQueryKey, (current) => {
          if (!current) {
            return nextToggledItem.savedByMe ? { items: [nextToggledItem] } : { items: [] };
          }

          const filtered = current.items.filter((item) => item.id !== postId);

          return nextToggledItem.savedByMe
            ? { items: [nextToggledItem, ...filtered] }
            : { items: filtered };
        });
      }

      return { previousFeeds, previousSavedPosts };
    },
    onError: (_error, _postId, context) => {
      if (context?.previousFeeds) {
        restorePreviousFeedQueries(queryClient, context.previousFeeds);
      }

      if (context?.previousSavedPosts) {
        queryClient.setQueryData(savedPostsQueryKey, context.previousSavedPosts);
      }
    },
    onSuccess: async (result) => {
      updateFeedQueries(queryClient, (current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === result.postId
              ? {
                  ...item,
                  savedByMe: result.savedByMe
                }
              : item
          )
        }))
      }));

      await queryClient.invalidateQueries({ queryKey: savedPostsQueryKey });
    }
  });
}

export function useRegisterMutation(onSuccess: (user: SafeUser) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RegisterInput) => registerUser(input),
    onSuccess: async (result) => {
      queryClient.setQueryData(currentUserQueryKey, { user: result.user });
      await queryClient.invalidateQueries({ queryKey: profileSummaryQueryKey });
      await queryClient.invalidateQueries({ queryKey: suggestedUsersQueryKey });
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
      onSuccess(result.user);
    }
  });
}

export function useLoginMutation(onSuccess: (user: SafeUser) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LoginInput) => loginUser(input),
    onSuccess: async (result) => {
      queryClient.setQueryData(currentUserQueryKey, { user: result.user });
      await queryClient.invalidateQueries({ queryKey: profileSummaryQueryKey });
      await queryClient.invalidateQueries({ queryKey: suggestedUsersQueryKey });
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
      onSuccess(result.user);
    }
  });
}

export function useLogoutMutation(onSuccess: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: async () => {
      queryClient.setQueryData(currentUserQueryKey, null);
      queryClient.setQueryData(profileSummaryQueryKey, null);
      queryClient.setQueryData(savedPostsQueryKey, null);
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
      await queryClient.invalidateQueries({ queryKey: suggestedUsersQueryKey });
      onSuccess();
    }
  });
}

export function useUpdateProfileMutation(onSuccess?: (user: SafeUser) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: async (result) => {
      queryClient.setQueryData(currentUserQueryKey, { user: result.user });
      await queryClient.invalidateQueries({ queryKey: profileSummaryQueryKey });
      await queryClient.invalidateQueries({ queryKey: suggestedUsersQueryKey });
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
      onSuccess?.(result.user);
    }
  });
}

export function useCreatePostMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostPayload) => createPost(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
      await queryClient.invalidateQueries({ queryKey: profileSummaryQueryKey });
      onSuccess?.();
    }
  });
}

export function useDeletePostMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postsQueryKey });
      await queryClient.cancelQueries({ queryKey: profileSummaryQueryKey });

      const previousFeeds = getPreviousFeedQueries(queryClient);
      const previousProfileSummary = queryClient.getQueryData<CurrentProfileResponse>(profileSummaryQueryKey);

      const didContainPost = previousFeeds.some(([, data]) =>
        data?.pages.some((page) => page.items.some((item) => item.id === postId))
      );

      updateFeedQueries(queryClient, (current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.id !== postId)
        }))
      }));

      if (didContainPost) {
        queryClient.setQueryData<CurrentProfileResponse>(profileSummaryQueryKey, (current) => {
          if (!current) {
            return current;
          }

          return {
            profile: {
              ...current.profile,
              postsCount: Math.max(0, current.profile.postsCount - 1)
            }
          };
        });
      }

      return {
        previousFeeds,
        previousProfileSummary
      };
    },
    onError: (_error, _postId, context) => {
      if (context?.previousFeeds) {
        restorePreviousFeedQueries(queryClient, context.previousFeeds);
      }

      if (context?.previousProfileSummary) {
        queryClient.setQueryData(profileSummaryQueryKey, context.previousProfileSummary);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
      await queryClient.invalidateQueries({ queryKey: profileSummaryQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["public-profile"] });
      onSuccess?.();
    }
  });
}

export function useCreateCommentMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(postId, input),
    onSuccess: async (result) => {
      queryClient.setQueryData<PostCommentsResponse | undefined>(commentsQueryKey(postId), (current) => {
        if (!current) {
          return {
            comments: [result.comment]
          };
        }

        return {
          comments: [...current.comments, result.comment]
        };
      });

      updateFeedQueries(queryClient, (current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  commentCount: item.commentCount + 1
                }
              : item
          )
        }))
      }));

      await queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
    }
  });
}

export function useUpdateCommentMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: CreateCommentInput }) =>
      updateComment(commentId, input),
    onSuccess: async (result) => {
      queryClient.setQueryData<PostCommentsResponse | undefined>(commentsQueryKey(postId), (current) => {
        if (!current) {
          return current;
        }

        return {
          comments: current.comments.map((comment) =>
            comment.id === result.comment.id ? result.comment : comment
          )
        };
      });

      await queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
    }
  });
}

export function useDeleteCommentMutation(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: async (result) => {
      queryClient.setQueryData<PostCommentsResponse | undefined>(commentsQueryKey(postId), (current) => {
        if (!current) {
          return current;
        }

        return {
          comments: current.comments.filter((comment) => comment.id !== result.commentId)
        };
      });

      updateFeedQueries(queryClient, (current) => ({
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === result.postId
              ? {
                  ...item,
                  commentCount: Math.max(0, item.commentCount - 1)
                }
              : item
          )
        }))
      }));

      await queryClient.invalidateQueries({ queryKey: commentsQueryKey(postId) });
    }
  });
}

export function useToggleFollowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleFollow,
    onSuccess: async (result) => {
      queryClient.setQueryData<SuggestedUsersResponse | null>(suggestedUsersQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          users: current.users.map((user) =>
            user.id === result.userId
              ? {
                  ...user,
                  isFollowing: result.isFollowing,
                  followersCount: result.followersCount
                }
              : user
          )
        };
      });

      await queryClient.invalidateQueries({ queryKey: profileSummaryQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["public-profile"] });
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
    }
  });
}

export function useGoogleLoginMutation(onSuccess: (user: SafeUser) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GoogleAuthInput) => loginWithGoogle(input),
    onSuccess: async (result) => {
      queryClient.setQueryData(currentUserQueryKey, { user: result.user });
      await queryClient.invalidateQueries({ queryKey: profileSummaryQueryKey });
      await queryClient.invalidateQueries({ queryKey: suggestedUsersQueryKey });
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
      onSuccess(result.user);
    }
  });
}

export function useSendDirectMessageMutation(onSuccess?: (conversationId: string) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, input }: { userId: string; input: SendDirectMessageInput }) => sendDirectMessage(userId, input),
    onSuccess: async (result) => {
      queryClient.setQueryData<ConversationsResponse | undefined>(conversationsQueryKey, (current) => {
        const nextConversation = result.conversation;

        if (!current) {
          return {
            conversations: [nextConversation]
          };
        }

        const conversations = current.conversations.filter((conversation) => conversation.id !== nextConversation.id);
        return {
          conversations: [nextConversation, ...conversations]
        };
      });

      queryClient.setQueryData<ConversationMessagesResponse | undefined>(
        conversationMessagesQueryKey(result.conversation.id),
        (current) => ({
          conversation: result.conversation,
          messages: [...(current?.messages ?? []), result.message]
        })
      );

      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
      await queryClient.invalidateQueries({ queryKey: conversationMessagesQueryKey(result.conversation.id) });
      onSuccess?.(result.conversation.id);
    }
  });
}

export function useMarkNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: (result: MarkNotificationsReadResponse) => {
      queryClient.setQueryData<NotificationsResponse | undefined>(notificationsQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
          unreadCount: result.unreadCount,
          notifications: current.notifications.map((notification) => ({
            ...notification,
            readAt: notification.readAt ?? new Date().toISOString()
          }))
        };
      });
    }
  });
}

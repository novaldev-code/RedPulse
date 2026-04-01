import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import type {
  CreateCommentInput,
  PostCommentsResponse,
  FeedResponse,
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  SafeUser,
  SuggestedUsersResponse
} from "@redpulse/validation";
import {
  createComment,
  createPost,
  getComments,
  getCurrentUser,
  getGoogleConfig,
  getPosts,
  getPublicProfile,
  getProfileSummary,
  getSuggestedUsers,
  loginUser,
  loginWithGoogle,
  logoutUser,
  registerUser,
  toggleFollow,
  toggleLike
} from "./api";
import type { CreatePostPayload } from "./api";

export const postsQueryKey = ["posts"] as const;
export const commentsQueryKey = (postId: string) => ["comments", postId] as const;
export const currentUserQueryKey = ["current-user"] as const;
export const profileSummaryQueryKey = ["profile-summary"] as const;
export const publicProfileQueryKey = (userId: string) => ["public-profile", userId] as const;
export const suggestedUsersQueryKey = ["suggested-users"] as const;
export const googleConfigQueryKey = ["google-config"] as const;

export function usePostsQuery() {
  return useInfiniteQuery({
    queryKey: postsQueryKey,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getPosts(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
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

export function useGoogleConfigQuery() {
  return useQuery({
    queryKey: googleConfigQueryKey,
    queryFn: getGoogleConfig,
    retry: false
  });
}

export function useToggleLikeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleLike,
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postsQueryKey });

      const previousFeed = queryClient.getQueryData<InfiniteData<FeedResponse>>(postsQueryKey);

      queryClient.setQueryData<InfiniteData<FeedResponse>>(postsQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
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
        };
      });

      return { previousFeed };
    },
    onError: (_error, _postId, context) => {
      if (context?.previousFeed) {
        queryClient.setQueryData(postsQueryKey, context.previousFeed);
      }
    },
    onSuccess: (result) => {
      queryClient.setQueryData<InfiniteData<FeedResponse>>(postsQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
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
        };
      });
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
      await queryClient.invalidateQueries({ queryKey: postsQueryKey });
      await queryClient.invalidateQueries({ queryKey: suggestedUsersQueryKey });
      onSuccess();
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

      queryClient.setQueryData<InfiniteData<FeedResponse>>(postsQueryKey, (current) => {
        if (!current) {
          return current;
        }

        return {
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
        };
      });

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

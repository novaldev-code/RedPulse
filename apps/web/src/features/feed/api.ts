import type {
  ConversationMessagesResponse,
  ConversationsResponse,
  CreateCommentInput,
  CreateCommentResponse,
  CreatePostResponse,
  CurrentProfileResponse,
  DeleteCommentResponse,
  DeletePostResponse,
  FeedResponse,
  FeedScope,
  GoogleAuthInput,
  LoginInput,
  MarkNotificationsReadResponse,
  NotificationsResponse,
  PublicProfileResponse,
  RegisterInput,
  SavedPostsResponse,
  SendDirectMessageInput,
  SendDirectMessageResponse,
  SafeUser,
  UpdateProfileInput,
  SuggestedUsersResponse,
  PostCommentsResponse,
  ToggleFollowResponse,
  ToggleLikeResponse,
  ToggleSaveResponse
} from "@redpulse/validation";
import { apiFetch } from "../../lib/api";

export type CreatePostPayload = {
  content?: string;
  location?: string;
  files?: File[];
};

export async function getPosts(cursor?: string | null, scope: FeedScope = "global") {
  const searchParams = new URLSearchParams();

  if (cursor) {
    searchParams.set("cursor", cursor);
  }

  searchParams.set("limit", "10");
  searchParams.set("scope", scope);

  return apiFetch<FeedResponse>(`/api/posts?${searchParams.toString()}`);
}

export async function toggleLike(postId: string) {
  return apiFetch<ToggleLikeResponse>(`/api/posts/${postId}/like`, {
    method: "POST"
  });
}

export async function toggleSave(postId: string) {
  return apiFetch<ToggleSaveResponse>(`/api/posts/${postId}/save`, {
    method: "POST"
  });
}

export async function getComments(postId: string) {
  return apiFetch<PostCommentsResponse>(`/api/posts/${postId}/comments`);
}

export async function createComment(postId: string, input: CreateCommentInput) {
  return apiFetch<CreateCommentResponse>(`/api/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateComment(commentId: string, input: CreateCommentInput) {
  return apiFetch<CreateCommentResponse>(`/api/comments/${commentId}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function deleteComment(commentId: string) {
  return apiFetch<DeleteCommentResponse>(`/api/comments/${commentId}`, {
    method: "DELETE"
  });
}

export async function registerUser(input: RegisterInput) {
  return apiFetch<{ user: SafeUser }>("/register", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loginUser(input: LoginInput) {
  return apiFetch<{ user: SafeUser }>("/login", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function logoutUser() {
  return apiFetch<void>("/logout", {
    method: "POST"
  });
}

export async function getCurrentUser() {
  return apiFetch<{ user: SafeUser }>("/me");
}

export async function createPost(input: CreatePostPayload) {
  const formData = new FormData();

  if (input.content?.trim()) {
    formData.set("content", input.content.trim());
  }

  if (input.location?.trim()) {
    formData.set("location", input.location.trim());
  }

  for (const file of input.files ?? []) {
    formData.append("media", file);
  }

  return apiFetch<CreatePostResponse>("/api/posts", {
    method: "POST",
    body: formData,
    timeoutMs: 45_000
  });
}

export async function deletePost(postId: string) {
  return apiFetch<DeletePostResponse>(`/api/posts/${postId}`, {
    method: "DELETE"
  });
}

export async function getProfileSummary() {
  return apiFetch<CurrentProfileResponse>("/api/profile/me");
}

export async function getSavedPosts() {
  return apiFetch<SavedPostsResponse>("/api/saved-posts");
}

export async function updateProfile(input: UpdateProfileInput) {
  return apiFetch<{ user: SafeUser }>("/api/profile/me", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export async function getPublicProfile(userId: string) {
  return apiFetch<PublicProfileResponse>(`/api/users/${userId}/profile`);
}

export async function getSuggestedUsers() {
  return apiFetch<SuggestedUsersResponse>("/api/users/suggestions");
}

export async function toggleFollow(userId: string) {
  return apiFetch<ToggleFollowResponse>(`/api/users/${userId}/follow`, {
    method: "POST"
  });
}

export async function getGoogleConfig() {
  return apiFetch<{ clientId: string }>("/auth/google/config");
}

export async function loginWithGoogle(input: GoogleAuthInput) {
  return apiFetch<{ user: SafeUser }>("/auth/google", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getConversations() {
  return apiFetch<ConversationsResponse>("/api/messages/conversations");
}

export async function getConversationMessages(conversationId: string) {
  return apiFetch<ConversationMessagesResponse>(`/api/messages/${conversationId}`);
}

export async function sendDirectMessage(userId: string, input: SendDirectMessageInput) {
  return apiFetch<SendDirectMessageResponse>(`/api/messages/direct/${userId}`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getNotifications() {
  return apiFetch<NotificationsResponse>("/api/notifications");
}

export async function markNotificationsRead() {
  return apiFetch<MarkNotificationsReadResponse>("/api/notifications/read-all", {
    method: "POST"
  });
}

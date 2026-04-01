import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ConversationSummary,
  CreatePostInput,
  FeedPost,
  LoginInput,
  Notification as AppNotification,
  PublicProfile,
  RegisterInput,
  SafeUser,
  SuggestedUser,
} from "@redpulse/validation";
import {
  Bell,
  Bookmark,
  Compass,
  Hash,
  Home,
  ImagePlus,
  Loader,
  LogOut,
  MapPin,
  Menu,
  MessageSquareText,
  Moon,
  MoonStar,
  PlusSquare,
  Search,
  Send,
  SendHorizontal,
  SmilePlus,
  Sun,
  SunMedium,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Button, Card, CardContent, CardTitle, Logo, cn } from "@redpulse/ui";
import { ApiError } from "./lib/api";
import { GoogleSignInButton } from "./features/auth/google-sign-in-button";
import { FeedList } from "./features/feed/feed-list";
import { PostCard } from "./features/feed/post-card";
import {
  useConversationMessagesQuery,
  useConversationsQuery,
  useCreatePostMutation,
  useCurrentUserQuery,
  useDeletePostMutation,
  useGoogleConfigQuery,
  useGoogleLoginMutation,
  useLoginMutation,
  useMarkNotificationsReadMutation,
  useNotificationsQuery,
  useLogoutMutation,
  usePostsQuery,
  useProfileSummaryQuery,
  usePublicProfileQuery,
  useRegisterMutation,
  useSavedPostsQuery,
  useSendDirectMessageMutation,
  useSuggestedUsersQuery,
  useToggleFollowMutation,
  useToggleLikeMutation,
  useToggleSaveMutation,
  useUpdateProfileMutation,
} from "./features/feed/hooks";

type AppView =
  | "home"
  | "search"
  | "explore"
  | "messages"
  | "notifications"
  | "create"
  | "profile"
  | "saved"
  | "more";
type ThemeMode = "dark" | "light";

type NetworkUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  followersCount: number;
  postsCount: number;
  mutualCount?: number;
  isFollowing: boolean;
};

type MessageThread = {
  user: NetworkUser;
  conversationId: string | null;
  lastMessage: string | null;
  updatedAt: string | null;
};

const initialPostState: CreatePostInput = {
  content: "",
  location: "",
};
const initialLoginState: LoginInput = {
  identifier: "",
  password: "",
};
const initialRegisterState: RegisterInput = {
  username: "",
  email: "",
  password: "",
};
const featuredLocations = [
  "Makassar, Indonesia",
  "Jakarta, Indonesia",
  "Bandung, Indonesia",
  "Bali, Indonesia",
  "Surabaya, Indonesia",
  "Yogyakarta, Indonesia",
];

function getGoogleAuthErrorMessage(value: string) {
  switch (value) {
    case "google-missing-code":
      return "Google tidak mengirim kode login. Coba masuk lagi.";
    case "google-email-not-verified":
      return "Email Google Anda belum terverifikasi.";
    case "google-redirect-mismatch":
      return "Redirect URI Google tidak cocok. Periksa Google Cloud Console.";
    case "google-invalid-client":
      return "Client ID atau Client Secret Google tidak cocok.";
    case "google-invalid-grant":
      return "Kode login Google ditolak. Biasanya ini karena redirect URI atau client secret tidak cocok.";
    case "google-missing-id-token":
      return "Google tidak mengirim ID token ke server.";
    case "google-login-failed":
      return "Login Google gagal. Coba lagi sebentar.";
    case "google-not-configured":
      return "Google login belum dikonfigurasi di server.";
    default:
      return "Login Google belum berhasil. Coba lagi.";
  }
}

function buildNetworkUsers(
  currentUserId: string,
  suggestions: SuggestedUser[],
  posts: FeedPost[],
) {
  const map = new Map<string, NetworkUser>();

  for (const user of suggestions) {
    if (user.id === currentUserId) {
      continue;
    }

    map.set(user.id, {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      followersCount: user.followersCount,
      postsCount: user.postsCount,
      mutualCount: user.mutualCount,
      isFollowing: user.isFollowing,
    });
  }

  for (const post of posts) {
    if (post.author.id === currentUserId || map.has(post.author.id)) {
      continue;
    }

    map.set(post.author.id, {
      id: post.author.id,
      username: post.author.username,
      avatarUrl: post.author.avatarUrl,
      bio: null,
      followersCount: 0,
      postsCount: posts.filter((item) => item.author.id === post.author.id)
        .length,
      mutualCount: 0,
      isFollowing: false,
    });
  }

  return Array.from(map.values());
}

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const stored = window.localStorage.getItem("redpulse-theme");
    if (stored === "dark" || stored === "light") {
      return stored;
    }

    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  });
  const [postForm, setPostForm] = useState<CreatePostInput>(initialPostState);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [showLocationField, setShowLocationField] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<
    string | null
  >(null);
  const [selectedMessageUserId, setSelectedMessageUserId] = useState<
    string | null
  >(null);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileBioDraft, setProfileBioDraft] = useState("");
  const [profileAvatarDraft, setProfileAvatarDraft] = useState("");
  const [loginForm, setLoginForm] = useState<LoginInput>(initialLoginState);
  const [registerForm, setRegisterForm] =
    useState<RegisterInput>(initialRegisterState);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authCooldownSeconds, setAuthCooldownSeconds] = useState(0);
  const [postError, setPostError] = useState<string | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data?.user ?? null;
  const profileSummaryQuery = useProfileSummaryQuery(Boolean(currentUser));
  const profileSummary = profileSummaryQuery.data?.profile ?? null;
  const publicProfileQuery = usePublicProfileQuery(
    currentUser &&
      selectedProfileUserId &&
      selectedProfileUserId !== currentUser.id
      ? selectedProfileUserId
      : null,
    Boolean(
      currentUser &&
      selectedProfileUserId &&
      selectedProfileUserId !== currentUser.id,
    ),
  );
  const suggestedUsersQuery = useSuggestedUsersQuery(Boolean(currentUser));
  const suggestions = suggestedUsersQuery.data?.users ?? [];
  const followingPostsQuery = usePostsQuery("following", Boolean(currentUser));
  const savedPostsQuery = useSavedPostsQuery(
    Boolean(currentUser && currentView === "saved"),
  );
  const conversationsQuery = useConversationsQuery(
    Boolean(currentUser && currentView === "messages"),
    currentView === "messages",
  );
  const notificationsQuery = useNotificationsQuery(
    Boolean(currentUser),
    currentView === "notifications",
  );
  const googleConfigQuery = useGoogleConfigQuery(!currentUser);
  const isOwnProfile =
    !selectedProfileUserId || selectedProfileUserId === currentUser?.id;
  const activeProfile: PublicProfile | null =
    isOwnProfile && currentUser && profileSummary
      ? {
          id: currentUser.id,
          username: currentUser.username,
          avatarUrl: currentUser.avatarUrl,
          bio: currentUser.bio,
          createdAt: currentUser.createdAt,
          postsCount: profileSummary.postsCount,
          followersCount: profileSummary.followersCount,
          followingCount: profileSummary.followingCount,
          isFollowing: false,
        }
      : (publicProfileQuery.data?.profile ?? null);

  const logoutMutation = useLogoutMutation(() => {
    setPostForm(initialPostState);
    setMediaFiles([]);
    setShowLocationField(false);
    setSelectedProfileUserId(null);
    setSelectedConversationId(null);
    setSelectedMessageUserId(null);
    setMessageDraft("");
    setAuthError(null);
    setAuthCooldownSeconds(0);
    setCurrentView("home");
  });

  const createPostMutation = useCreatePostMutation(() => {
    setPostForm(initialPostState);
    setMediaFiles([]);
    setShowLocationField(false);
    setPostError(null);
    setCurrentView("home");
  });
  const deletePostMutation = useDeletePostMutation();
  const loginMutation = useLoginMutation(() => {
    setAuthError(null);
    setAuthCooldownSeconds(0);
    setLoginForm(initialLoginState);
  });
  const registerMutation = useRegisterMutation(() => {
    setAuthError(null);
    setAuthCooldownSeconds(0);
    setRegisterForm(initialRegisterState);
  });
  const googleLoginMutation = useGoogleLoginMutation(() => {
    setAuthError(null);
    setAuthCooldownSeconds(0);
  });
  const updateProfileMutation = useUpdateProfileMutation((user: SafeUser) => {
    setEditingProfile(false);
    setProfileBioDraft(user.bio ?? "");
    setProfileAvatarDraft(user.avatarUrl ?? "");
  });
  const sendDirectMessageMutation = useSendDirectMessageMutation(
    (conversationId) => {
      setSelectedConversationId(conversationId);
      setMessageDraft("");
    },
  );
  const markNotificationsReadMutation = useMarkNotificationsReadMutation();
  const likeMutation = useToggleLikeMutation();
  const saveMutation = useToggleSaveMutation();

  const followMutation = useToggleFollowMutation();
  const isLightTheme = themeMode === "light";
  const isAuthenticated = Boolean(currentUser);
  const authLoading =
    currentUserQuery.isLoading || (!currentUser && googleConfigQuery.isLoading);
  const restoringSession = currentUserQuery.isLoading;
  const googleClientId = googleConfigQuery.data?.clientId ?? "";
  const followingPosts =
    followingPostsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const savedPosts = savedPostsQuery.data?.items ?? [];
  const conversations = conversationsQuery.data?.conversations ?? [];
  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadNotifications = notificationsQuery.data?.unreadCount ?? 0;
  const canSubmitPost = Boolean(
    postForm.content?.trim() || mediaFiles.length > 0,
  );
  const mediaPreviews = useMemo(
    () =>
      mediaFiles.map((file) => ({
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file),
      })),
    [mediaFiles],
  );
  const trendingTopics = useMemo(() => {
    const topics = new Map<string, number>();

    for (const post of followingPosts) {
      const matches = post.content?.match(/#[\p{L}\p{N}_]+/gu) ?? [];

      for (const match of matches) {
        const normalized = match.toLowerCase();
        topics.set(normalized, (topics.get(normalized) ?? 0) + 1);
      }
    }

    return Array.from(topics.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
      .map(([label, count]) => ({
        label,
        count,
      }));
  }, [followingPosts]);

  const storyUsers = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    const seen = new Set<string>();
    const feedAuthors =
      followingPosts
        .map((post) => ({
          id: post.author.id,
          username: post.author.username,
          avatarUrl: post.author.avatarUrl,
          subtitle: "Mengikuti",
        }));

    const suggestionAuthors = suggestions.map((user) => ({
      id: user.id,
        username: user.username,
        avatarUrl: user.avatarUrl,
        subtitle:
          user.mutualCount && user.mutualCount > 0
            ? `${user.mutualCount} koneksi serupa`
            : user.isFollowing
              ? "Mengikuti"
              : "Direkomendasikan",
      }));

    return [
      {
        id: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        subtitle: "Story Anda",
      },
      ...feedAuthors,
      ...suggestionAuthors,
    ].filter((user) => {
      if (seen.has(user.id)) {
        return false;
      }

      seen.add(user.id);
      return true;
    });
  }, [currentUser, followingPosts, suggestions]);

  const networkUsers = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    return buildNetworkUsers(currentUser.id, suggestions, followingPosts);
  }, [currentUser, followingPosts, suggestions]);

  const messageThreads = useMemo(() => {
    const map = new Map<string, MessageThread>();

    for (const conversation of conversations) {
      map.set(conversation.participant.id, {
        user: {
          id: conversation.participant.id,
          username: conversation.participant.username,
          avatarUrl: conversation.participant.avatarUrl,
          bio: conversation.participant.bio,
          followersCount: 0,
          postsCount: 0,
          isFollowing:
            suggestions.find((user) => user.id === conversation.participant.id)
              ?.isFollowing ?? false,
        },
        conversationId: conversation.id,
        lastMessage: conversation.lastMessage?.content ?? null,
        updatedAt: conversation.updatedAt,
      });
    }

    for (const user of networkUsers) {
      if (map.has(user.id)) {
        continue;
      }

      map.set(user.id, {
        user,
        conversationId: null,
        lastMessage: null,
        updatedAt: null,
      });
    }

    return Array.from(map.values()).sort((left, right) => {
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt
        ? new Date(right.updatedAt).getTime()
        : 0;

      return (
        rightTime - leftTime ||
        left.user.username.localeCompare(right.user.username)
      );
    });
  }, [conversations, networkUsers, suggestions]);

  const selectedThread = useMemo(() => {
    if (selectedConversationId) {
      return (
        messageThreads.find(
          (thread) => thread.conversationId === selectedConversationId,
        ) ?? null
      );
    }

    if (selectedMessageUserId) {
      return (
        messageThreads.find(
          (thread) => thread.user.id === selectedMessageUserId,
        ) ?? null
      );
    }

    return messageThreads[0] ?? null;
  }, [messageThreads, selectedConversationId, selectedMessageUserId]);

  const conversationMessagesQuery = useConversationMessagesQuery(
    selectedThread?.conversationId ?? null,
    Boolean(currentUser && selectedThread?.conversationId),
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return networkUsers;
    }

    return networkUsers.filter((user) => {
      const username = user.username.toLowerCase();
      const bio = user.bio?.toLowerCase() ?? "";
      return username.includes(query) || bio.includes(query);
    });
  }, [networkUsers, searchQuery]);

  const selectedMessageUser = selectedThread?.user ?? null;

  const profilePosts = useMemo(
    () => followingPosts.filter((post) => post.author.id === currentUser?.id),
    [followingPosts, currentUser?.id],
  );
  const displayedProfilePosts = isOwnProfile
    ? profilePosts
    : (publicProfileQuery.data?.posts ?? []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", themeMode === "dark");
    window.localStorage.setItem("redpulse-theme", themeMode);
  }, [themeMode]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const authErrorParam = searchParams.get("authError");
    const authSuccessParam = searchParams.get("auth");

    if (authErrorParam) {
      setAuthError(getGoogleAuthErrorMessage(authErrorParam));
      searchParams.delete("authError");
    }

    if (authSuccessParam === "success") {
      setAuthError(null);
      searchParams.delete("auth");
    }

    const nextQuery = searchParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  useEffect(() => {
    const firstThread = messageThreads[0];

    if (!selectedMessageUserId && !selectedConversationId && firstThread) {
      setSelectedMessageUserId(firstThread.user.id);
      setSelectedConversationId(firstThread.conversationId);
    }
  }, [messageThreads, selectedConversationId, selectedMessageUserId]);

  useEffect(() => {
    if (authCooldownSeconds <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setAuthCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [authCooldownSeconds]);

  useEffect(() => {
    return () => {
      for (const preview of mediaPreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [mediaPreviews]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setProfileBioDraft(currentUser.bio ?? "");
    setProfileAvatarDraft(currentUser.avatarUrl ?? "");
  }, [currentUser?.avatarUrl, currentUser?.bio, currentUser?.id]);

  useEffect(() => {
    if (
      !currentUser ||
      currentView !== "notifications" ||
      unreadNotifications === 0 ||
      markNotificationsReadMutation.isPending
    ) {
      return;
    }

    markNotificationsReadMutation.mutate();
  }, [
    currentUser,
    currentView,
    unreadNotifications,
    markNotificationsReadMutation,
  ]);

  useEffect(() => {
    if (currentView !== "messages") {
      return;
    }

    const timeout = window.setTimeout(() => {
      messageEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 60);

    return () => window.clearTimeout(timeout);
  }, [
    conversationMessagesQuery.data?.messages.length,
    currentView,
    selectedThread?.conversationId,
  ]);

  function handlePostError(error: unknown) {
    if (error instanceof ApiError) {
      setPostError(error.message);
      return;
    }

    setPostError("Post gagal dikirim. Coba lagi sebentar.");
  }

  function handleAuthError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.retryAfterSeconds) {
        setAuthCooldownSeconds(error.retryAfterSeconds);
      }
      setAuthError(error.message);
      return;
    }

    setAuthError("Autentikasi gagal. Coba lagi sebentar.");
  }

  function handleGoogleError(error: unknown) {
    if (error instanceof ApiError) {
      if (error.retryAfterSeconds) {
        setAuthCooldownSeconds(error.retryAfterSeconds);
      }
      setAuthError(error.message);
      return;
    }

    setAuthError("Login Google gagal. Coba lagi sebentar.");
  }

  function appendToComposer(token: string) {
    setPostForm((current) => ({
      ...current,
      content: `${current.content ?? ""}${token}`.slice(0, 280),
    }));
  }

  function openProfile(userId?: string | null) {
    if (!userId || userId === currentUser?.id) {
      setSelectedProfileUserId(null);
      setCurrentView("profile");
      return;
    }

    setSelectedProfileUserId(userId);
    setCurrentView("profile");
  }

  function openMessages(userId: string, conversationId?: string | null) {
    setSelectedMessageUserId(userId);
    setSelectedConversationId(conversationId ?? null);
    setCurrentView("messages");
  }

  const authLocked = authCooldownSeconds > 0;

  const shellClass = isLightTheme
    ? "bg-[radial-gradient(circle_at_top,rgba(255,0,0,0.05),transparent_24%),linear-gradient(180deg,#fafafa_0%,#f3f4f6_100%)] text-slate-950"
    : "";
  const surfaceClass = isLightTheme
    ? "bg-white border-black/8 shadow-[0_18px_48px_rgba(15,23,42,0.08)]"
    : "bg-[#090909]";
  const softSurfaceClass = isLightTheme
    ? "border-black/8 bg-black/[0.03]"
    : "border-white/10 bg-white/[0.02]";
  const subtleTextClass = isLightTheme ? "text-slate-600" : "text-white/55";
  const faintTextClass = isLightTheme ? "text-slate-400" : "text-white/38";
  const navChromeClass = isLightTheme
    ? "border-black/8 bg-white/95"
    : "border-white/8 bg-black/95";
  const panelHeadingClass = isLightTheme ? "text-slate-900" : "text-white/88";
  const utilityButtonClass = isLightTheme
    ? "w-full rounded-2xl border border-black/8 bg-black/[0.03] px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-black/[0.05]"
    : "w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-white/70 transition hover:bg-white/[0.04]";
  const softPanelClass = isLightTheme
    ? "rounded-[24px] border border-black/8 bg-black/[0.03] p-4 text-sm leading-7 text-slate-600"
    : "rounded-[24px] border border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-white/62";

  function getCurrentViewLabel() {
    switch (currentView) {
      case "search":
        return "Cari";
      case "explore":
        return "Jelajahi";
      case "messages":
        return "Pesan";
      case "notifications":
        return "Notifikasi";
      case "create":
        return "Buat";
      case "profile":
        return "Profil";
      case "saved":
        return "Tersimpan";
      case "more":
        return "Lainnya";
      case "home":
      default:
        return "Beranda";
    }
  }

  function renderComposer() {
    return (
      <section className="pb-4 md:pb-5">
        <div
          className={cn(
            "rounded-[24px] border p-3.5 shadow-[0_18px_46px_rgba(0,0,0,0.2)] md:rounded-[30px] md:p-5",
            surfaceClass,
          )}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPostError(null);
              createPostMutation.mutate(
                {
                  content: postForm.content,
                  location: postForm.location,
                  files: mediaFiles,
                },
                {
                  onError: handlePostError,
                },
              );
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p
                  className={cn(
                    "text-xs font-semibold uppercase tracking-[0.22em]",
                    faintTextClass,
                  )}
                >
                  Composer
                </p>
                <p className={cn("mt-1 text-xs md:text-sm", subtleTextClass)}>
                  Bagikan update, foto, atau video ke feed Anda.
                </p>
              </div>
              <div
                className={cn(
                  "text-xs uppercase tracking-[0.18em]",
                  faintTextClass,
                )}
              >
                {mediaFiles.length > 0
                  ? `${mediaFiles.length}/4 media`
                  : "Caption atau media"}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Avatar
                username={currentUser!.username}
                avatarUrl={currentUser!.avatarUrl}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <textarea
                  className="min-h-24 w-full rounded-[18px] border border-border bg-background/70 px-3.5 py-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-ring/40 focus:bg-background md:min-h-28 md:rounded-[22px] md:px-4 md:py-4"
                  maxLength={280}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      content: event.target.value,
                    }))
                  }
                  placeholder="Apa yang sedang Anda pikirkan hari ini?"
                  value={postForm.content ?? ""}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={cn("text-xs md:text-sm", subtleTextClass)}>
                Posting sebagai{" "}
                <span className="font-semibold text-foreground">
                  @{currentUser!.username}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-xs md:text-sm", subtleTextClass)}>
                  {postForm.content?.length ?? 0}/280
                </span>
                <Button
                  type="submit"
                  disabled={createPostMutation.isPending || !canSubmitPost}
                  className="rounded-full px-5"
                >
                  {createPostMutation.isPending ? "Memposting..." : "Posting"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-4 space-y-4">
            <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-wrap md:gap-3 md:overflow-visible md:px-0">
              <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-2 text-xs font-medium text-foreground/75 transition hover:border-foreground/15 hover:bg-card md:px-4 md:text-sm">
                <ImagePlus className="h-4 w-4 text-primary" />
                Tambah foto atau video
                <input
                  accept="image/*,video/*"
                  className="hidden"
                  multiple
                  onChange={(event) => {
                    const selectedFiles = Array.from(
                      event.target.files ?? [],
                    ).slice(0, 4);
                    setMediaFiles(selectedFiles);
                  }}
                  type="file"
                />
              </label>
              <button
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-2 text-xs font-medium text-foreground/70 transition hover:border-foreground/15 hover:bg-card hover:text-foreground md:px-4 md:text-sm"
                onClick={() => appendToComposer("Mood: ")}
                type="button"
              >
                <SmilePlus className="h-4 w-4" />
                Tambah mood
              </button>
              <button
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-2 text-xs font-medium text-foreground/70 transition hover:border-foreground/15 hover:bg-card hover:text-foreground md:px-4 md:text-sm"
                onClick={() => setShowLocationField((current) => !current)}
                type="button"
              >
                <MapPin className="h-4 w-4" />
                {postForm.location?.trim()
                  ? postForm.location
                  : "Tambah lokasi"}
              </button>
              {mediaFiles.length > 0 ? (
                <button
                  className="shrink-0 text-xs font-medium text-foreground/45 transition hover:text-foreground md:text-sm"
                  onClick={() => setMediaFiles([])}
                  type="button"
                >
                  Hapus semua
                </button>
              ) : null}
            </div>

            {mediaPreviews.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {mediaPreviews.map((preview, index) => (
                  <div
                    key={`${preview.name}-${index}`}
                    className="overflow-hidden rounded-[18px] border border-border bg-card/60 transition hover:-translate-y-0.5 hover:border-foreground/15 md:rounded-[22px]"
                  >
                    <div className="aspect-[4/3] bg-background">
                      {preview.type.startsWith("video/") ? (
                        <video
                          className="h-full w-full object-cover"
                          controls
                          muted
                          playsInline
                          src={preview.url}
                        />
                      ) : (
                        <img
                          alt={preview.name}
                          className="h-full w-full object-cover"
                          src={preview.url}
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <p className="truncate text-sm text-foreground/62">
                        {preview.name}
                      </p>
                      <button
                        className="text-xs font-semibold text-primary"
                        onClick={() =>
                          setMediaFiles((current) =>
                            current.filter(
                              (_, fileIndex) => fileIndex !== index,
                            ),
                          )
                        }
                        type="button"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {showLocationField ? (
              <div className="space-y-3 rounded-[18px] border border-border bg-card/60 p-3.5 md:rounded-[22px] md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Lokasi post
                    </p>
                    <p className="mt-1 text-xs text-foreground/45">
                      Tambahkan kota, venue, atau area supaya post terasa lebih
                      hidup.
                    </p>
                  </div>
                  {postForm.location?.trim() ? (
                    <button
                      className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/40 transition hover:text-foreground"
                      onClick={() =>
                        setPostForm((current) => ({ ...current, location: "" }))
                      }
                      type="button"
                    >
                      Hapus
                    </button>
                  ) : null}
                </div>

                <input
                  className="w-full rounded-[18px] border border-border bg-background/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/30 focus:bg-background"
                  list="composer-location-options"
                  maxLength={160}
                  onChange={(event) =>
                    setPostForm((current) => ({
                      ...current,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Contoh: Makassar, Indonesia"
                  value={postForm.location ?? ""}
                />
                <datalist id="composer-location-options">
                  {featuredLocations.map((location) => (
                    <option key={location} value={location} />
                  ))}
                </datalist>

                <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
                  {featuredLocations.map((location) => (
                    <button
                      key={location}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition",
                        postForm.location === location
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-border bg-background/55 text-foreground/65 hover:bg-card hover:text-foreground",
                      )}
                      onClick={() =>
                        setPostForm((current) => ({ ...current, location }))
                      }
                      type="button"
                    >
                      {location}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="hide-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-[11px] text-foreground/40 md:mx-0 md:flex-wrap md:gap-3 md:overflow-visible md:px-0 md:text-xs">
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-card/60 px-3 py-2">
                <ImagePlus className="h-3.5 w-3.5 text-primary" />
                Maksimal 4 media
              </span>
              <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-card/60 px-3 py-2">
                <SmilePlus className="h-3.5 w-3.5" />
                Caption lebih personal terasa lebih hidup
              </span>
            </div>
          </div>

          {postError ? (
            <div className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {postError}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  function renderMainContent() {
    if (currentView === "search") {
      return (
        <div className="space-y-6">
          <SectionHeader
            title="Cari akun"
            description="Temukan akun lain berdasarkan username atau bio."
          />
          <Card className={surfaceClass}>
            <CardContent className="space-y-4 p-5">
              <input
                className="w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary/45 focus:bg-card"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari username atau bio"
                value={searchQuery}
              />
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <EmptyState
                    title="Tidak ada hasil"
                    description="Belum ada akun yang cocok dengan pencarian Anda."
                  />
                ) : (
                  filteredUsers.map((user) => (
                    <SuggestedUserRow
                      key={user.id}
                      user={user}
                      disabled={
                        followMutation.isPending &&
                        followMutation.variables === user.id
                      }
                      onFollow={() => followMutation.mutate(user.id)}
                      onOpenProfile={openProfile}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (currentView === "explore") {
      return (
        <div className="space-y-6">
          <SectionHeader
            title="Jelajahi"
            description="Lihat post publik terbaru, topik yang ramai, dan akun yang mungkin relevan di luar lingkar mengikuti Anda."
          />
          <FeedList
            scope="global"
            canLike={true}
            currentUserId={currentUser?.id}
            onCreateFirstPost={() => setCurrentView("create")}
            onOpenProfile={openProfile}
          />
        </div>
      );
    }

    if (currentView === "messages") {
      return (
        <div className="space-y-6">
          <SectionHeader
            title="Pesan"
            description="Percakapan kini terasa lebih seperti real chat. Pilih kontak, lihat bubble pesan yang lebih natural, dan balas langsung dari composer bawah."
          />
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card className={cn(surfaceClass, "overflow-hidden p-0")}>
              <CardContent className="space-y-3 p-3">
                <div className="rounded-[22px] border border-border bg-background/55 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/38">
                    Inbox
                  </p>
                  <p className="mt-2 text-sm text-foreground/60">
                    Pilih orang untuk lanjut ngobrol atau mulai DM baru dari
                    sini.
                  </p>
                </div>
                {messageThreads.length === 0 ? (
                  <EmptyState
                    title="Belum ada percakapan"
                    description="Saat ada akun lain di jaringan Anda, daftar percakapan akan muncul di sini."
                  />
                ) : (
                  messageThreads.map((thread) => (
                    <button
                      key={thread.user.id}
                      className={`flex w-full items-center gap-3 rounded-[22px] border px-3 py-3 text-left transition ${
                        selectedMessageUser?.id === thread.user.id
                          ? "border-primary/25 bg-primary/8 text-foreground shadow-[0_10px_24px_rgba(255,0,0,0.06)]"
                          : "border-border text-foreground/72 hover:bg-foreground/[0.03] hover:text-foreground"
                      }`}
                      onClick={() =>
                        openMessages(thread.user.id, thread.conversationId)
                      }
                      type="button"
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          username={thread.user.username}
                          avatarUrl={thread.user.avatarUrl}
                          size="md"
                        />
                        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500/80" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            className="block truncate text-left text-sm font-semibold text-foreground transition hover:text-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              openProfile(thread.user.id);
                            }}
                            type="button"
                          >
                            @{thread.user.username}
                          </button>
                          <span className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-foreground/35">
                            {thread.updatedAt
                              ? getRelativeActivityTime(thread.updatedAt)
                              : "baru"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-foreground/45">
                          {thread.lastMessage ??
                            thread.user.bio ??
                            "Mulai percakapan baru."}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-foreground/28">
                          {thread.conversationId
                            ? "Percakapan aktif"
                            : "DM baru"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className={cn(surfaceClass, "overflow-hidden")}>
              <CardContent className="space-y-0 p-0">
                {selectedMessageUser ? (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar
                          username={selectedMessageUser.username}
                          avatarUrl={selectedMessageUser.avatarUrl}
                          size="md"
                        />
                        <div className="min-w-0">
                          <button
                            className="truncate text-left font-semibold text-foreground transition hover:text-primary"
                            onClick={() => openProfile(selectedMessageUser.id)}
                            type="button"
                          >
                            @{selectedMessageUser.username}
                          </button>
                          <p className="truncate text-sm text-foreground/45">
                            {selectedMessageUser.bio ?? "Siap untuk terhubung."}
                          </p>
                        </div>
                      </div>
                      <div className="hidden sm:block">
                        <Button
                          className="rounded-full px-4"
                          onClick={() => openProfile(selectedMessageUser.id)}
                          size="sm"
                          variant="outline"
                        >
                          Buka profil
                        </Button>
                      </div>
                    </div>
                    <div className="flex h-[540px] flex-col">
                      <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(255,0,0,0.04),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] px-4 py-4">
                        {conversationMessagesQuery.isLoading &&
                        selectedThread?.conversationId ? (
                          <div className="flex items-center gap-3 rounded-[20px] border border-border bg-card/70 px-4 py-3 text-sm text-foreground/62">
                            <Loader className="h-4 w-4 animate-spin text-primary" />
                            Memuat percakapan...
                          </div>
                        ) : conversationMessagesQuery.data?.messages.length ? (
                          <div className="space-y-3">
                            {conversationMessagesQuery.data.messages.map(
                              (message) => {
                                const mine =
                                  message.senderId === currentUser!.id;

                                return (
                                  <div
                                    key={message.id}
                                    className={cn(
                                      "flex items-end gap-2",
                                      mine ? "justify-end" : "justify-start",
                                    )}
                                  >
                                    {!mine ? (
                                      <Avatar
                                        username={message.sender.username}
                                        avatarUrl={message.sender.avatarUrl}
                                        size="md"
                                      />
                                    ) : null}
                                    <div
                                      className={cn(
                                        "max-w-[88%] rounded-[24px] px-4 py-3 text-sm leading-7 shadow-[0_10px_24px_rgba(15,23,42,0.06)]",
                                        mine
                                          ? "rounded-br-[10px] bg-primary text-black"
                                          : "rounded-bl-[10px] border border-border bg-card text-foreground/82",
                                      )}
                                    >
                                      <p className="whitespace-pre-wrap break-words">
                                        {message.content}
                                      </p>
                                      <div
                                        className={cn(
                                          "mt-2 flex items-center justify-end gap-2 text-[11px]",
                                          mine
                                            ? "text-black/60"
                                            : "text-foreground/38",
                                        )}
                                      >
                                        <span>
                                          {new Date(
                                            message.createdAt,
                                          ).toLocaleString("id-ID", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            day: "2-digit",
                                            month: "short",
                                          })}
                                        </span>
                                        {mine ? (
                                          <span className="font-semibold">
                                            Terkirim
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                            <div ref={messageEndRef} />
                          </div>
                        ) : (
                          <div className="rounded-[22px] border border-border bg-card/70 px-4 py-5 text-sm leading-7 text-foreground/62">
                            Belum ada pesan dengan @
                            {selectedMessageUser.username}. Kirim pesan pertama
                            untuk memulai percakapan yang lebih hidup.
                          </div>
                        )}
                      </div>
                      <form
                        className="border-t border-border bg-card/90 p-4"
                        onSubmit={(event) => {
                          event.preventDefault();

                          if (!messageDraft.trim()) {
                            return;
                          }

                          sendDirectMessageMutation.mutate({
                            userId: selectedMessageUser.id,
                            input: {
                              content: messageDraft.trim(),
                            },
                          });
                        }}
                      >
                        <div className="rounded-[24px] border border-border bg-background/65 p-3">
                          <textarea
                            className="min-h-20 w-full resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none transition placeholder:text-foreground/32"
                            onChange={(event) =>
                              setMessageDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();

                                if (
                                  !messageDraft.trim() ||
                                  sendDirectMessageMutation.isPending
                                ) {
                                  return;
                                }

                                sendDirectMessageMutation.mutate({
                                  userId: selectedMessageUser.id,
                                  input: {
                                    content: messageDraft.trim(),
                                  },
                                });
                              }
                            }}
                            placeholder={`Tulis pesan untuk @${selectedMessageUser.username}...`}
                            value={messageDraft}
                          />
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs text-foreground/38">
                              <MessageSquareText className="h-4 w-4 text-primary" />{" "}
                            </div>
                            <Button
                              className="rounded-full px-4"
                              disabled={
                                sendDirectMessageMutation.isPending ||
                                !messageDraft.trim()
                              }
                              type="submit"
                            >
                              <SendHorizontal className="mr-2 h-4 w-4" />
                              {sendDirectMessageMutation.isPending
                                ? "Mengirim..."
                                : "Kirim"}
                            </Button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="Belum ada user"
                    description="Daftar pesan akan aktif setelah ada akun lain yang bisa Anda pilih."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    if (currentView === "notifications") {
      return (
        <div className="space-y-6">
          <SectionHeader
            title="Notifikasi"
            description="Update follow, pesan, like, komentar, dan post baru dari jaringan Anda muncul di sini."
          />
          <Card className={surfaceClass}>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Aktivitas terbaru
                  </p>
                  <p className="mt-1 text-xs text-foreground/45">
                    {unreadNotifications > 0
                      ? `${unreadNotifications} notifikasi belum dibaca.`
                      : "Semua notifikasi sudah terbaca."}
                  </p>
                </div>
                <NotificationBadgeButton
                  count={unreadNotifications}
                  onClick={() => void notificationsQuery.refetch()}
                />
              </div>

              {notificationsQuery.isLoading ? (
                <div className="rounded-2xl border border-border bg-card/70 px-4 py-4 text-sm text-foreground/62">
                  Memuat notifikasi terbaru...
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  title="Belum ada notifikasi"
                  description="Saat ada yang follow, kirim pesan, memberi Pulse, komentar, atau post baru dari jaringan Anda, semuanya akan muncul di sini."
                />
              ) : (
                notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (currentView === "create") {
      return (
        <div className="space-y-6">
          <SectionHeader
            title="Buat post"
            description="Tulis update baru dan kirim langsung ke feed publik Anda."
          />
          {renderComposer()}
          <Card className={surfaceClass}>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-foreground">Tips cepat</p>
              <p className="text-sm leading-7 text-foreground/60">
                Tulis singkat, jelas, dan fokus. Setelah post terkirim, Anda
                akan langsung dibawa kembali ke beranda.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (currentView === "saved") {
      return (
        <div className="space-y-6">
          <SectionHeader
            title="Tersimpan"
            description="Kumpulan post yang Anda simpan untuk dibuka lagi nanti. Cocok untuk referensi, inspirasi, atau sekadar post yang ingin Anda baca ulang."
          />
          {savedPostsQuery.isLoading ? (
            <Card className={surfaceClass}>
              <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground/62">
                <Loader className="h-4 w-4 animate-spin text-primary" />
                Memuat post tersimpan...
              </CardContent>
            </Card>
          ) : savedPosts.length === 0 ? (
            <EmptyState
              title="Belum ada post tersimpan"
              description="Tekan ikon bookmark pada post yang Anda suka. Semua yang disimpan akan muncul rapi di halaman ini."
            />
          ) : (
            <div className="space-y-5">
              {savedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  canLike={true}
                  currentUserId={currentUser?.id}
                  deleting={deletePostMutation.isPending && deletePostMutation.variables === post.id}
                  isOwner={post.author.id === currentUser?.id}
                  liking={likeMutation.isPending && likeMutation.variables === post.id}
                  onDelete={(postId) => deletePostMutation.mutate(postId)}
                  onLike={(postId) => likeMutation.mutate(postId)}
                  onOpenProfile={openProfile}
                  onRequireAuth={() => setCurrentView("home")}
                  onSave={(postId) => saveMutation.mutate(postId)}
                  post={post}
                  saving={saveMutation.isPending && saveMutation.variables === post.id}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    if (currentView === "profile") {
      const profileTitle = isOwnProfile
        ? "Profil"
        : `@${activeProfile?.username ?? "profil"}`;
      const profileDescription = isOwnProfile
        ? "Ringkasan akun Anda dan post yang sudah dipublikasikan."
        : "Lihat profil publik user lain, lengkap dengan post yang sudah mereka bagikan.";

      return (
        <div className="space-y-6">
          <SectionHeader
            title={profileTitle}
            description={profileDescription}
          />
          {!isOwnProfile && publicProfileQuery.isLoading ? (
            <Card className={surfaceClass}>
              <CardContent className="flex items-center gap-3 p-5 text-sm text-foreground/62">
                <Loader className="h-4 w-4 animate-spin text-primary" />
                Memuat profil user...
              </CardContent>
            </Card>
          ) : null}
          {!isOwnProfile && publicProfileQuery.isError ? (
            <Card className={surfaceClass}>
              <CardContent className="p-5 text-sm text-red-400">
                Profil user ini belum bisa dimuat sekarang.
              </CardContent>
            </Card>
          ) : null}
          <Card className={surfaceClass}>
            <CardContent className="space-y-5 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar
                  username={
                    activeProfile?.username ??
                    (isOwnProfile ? currentUser!.username : "RP")
                  }
                  avatarUrl={
                    activeProfile?.avatarUrl ??
                    (isOwnProfile ? currentUser!.avatarUrl : null)
                  }
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                      @
                      {activeProfile?.username ??
                        (isOwnProfile ? currentUser!.username : "profil")}
                    </p>
                    <span className="inline-flex rounded-full border border-border bg-card/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/40">
                      {isOwnProfile ? "Akun Anda" : "Profil publik"}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-sm text-foreground/50">
                    {isOwnProfile
                      ? currentUser!.email
                      : "Lihat jaringan, aktivitas, dan post publik user ini."}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-foreground/60">
                    @
                    {activeProfile?.username ??
                      (isOwnProfile ? currentUser!.username : "profil")}
                  </p>
                  <p className="text-sm leading-7 text-foreground/60">
                    {activeProfile?.bio ?? "Belum ada bio untuk akun ini."}
                  </p>
                </div>
              </div>
              {activeProfile ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <StatCard label="Posts" value={activeProfile.postsCount} />
                  <StatCard
                    label="Followers"
                    value={activeProfile.followersCount}
                  />
                  <StatCard
                    label="Following"
                    value={activeProfile.followingCount}
                  />
                </div>
              ) : null}
              {!isOwnProfile && activeProfile ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button
                    className="justify-center rounded-full px-5"
                    variant={activeProfile.isFollowing ? "outline" : "default"}
                    disabled={
                      followMutation.isPending &&
                      followMutation.variables === activeProfile.id
                    }
                    onClick={() => followMutation.mutate(activeProfile.id)}
                  >
                    {activeProfile.isFollowing ? "Batal mengikuti" : "Ikuti"}
                  </Button>
                  <Button
                    className="justify-center rounded-full px-5"
                    variant="outline"
                    onClick={() => openMessages(activeProfile.id)}
                  >
                    Kirim pesan
                  </Button>
                </div>
              ) : null}
              {isOwnProfile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                    <Button
                      className="justify-center rounded-full px-4 sm:px-5"
                      variant="outline"
                      onClick={() => setEditingProfile((current) => !current)}
                    >
                      {editingProfile ? "Tutup edit" : "Edit profil"}
                    </Button>
                    <Button
                      className="justify-center rounded-full px-4 sm:px-5"
                      variant="outline"
                      onClick={() => setCurrentView("saved")}
                    >
                      <Bookmark className="mr-2 h-4 w-4" />
                      Tersimpan
                    </Button>
                    <Button
                      className="justify-center rounded-full px-4 sm:px-5"
                      variant="outline"
                      onClick={() => setCurrentView("more")}
                    >
                      <Menu className="mr-2 h-4 w-4" />
                      Lainnya
                    </Button>
                    <Button
                      className="col-span-2 justify-center rounded-full px-4 sm:col-span-1 sm:px-5"
                      variant="ghost"
                      disabled={logoutMutation.isPending}
                      onClick={() => logoutMutation.mutate()}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      {logoutMutation.isPending ? "Keluar..." : "Logout"}
                    </Button>
                  </div>
                  {editingProfile ? (
                    <form
                      className="space-y-3 rounded-[22px] border border-border bg-card/60 p-3.5 sm:p-4"
                      onSubmit={(event) => {
                        event.preventDefault();
                        updateProfileMutation.mutate({
                          bio: profileBioDraft,
                          avatarUrl: profileAvatarDraft,
                        });
                      }}
                    >
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-foreground/76">
                          Bio
                        </span>
                        <textarea
                          className="min-h-24 w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/45 focus:bg-card"
                          maxLength={160}
                          onChange={(event) =>
                            setProfileBioDraft(event.target.value)
                          }
                          placeholder="Tulis bio singkat yang mewakili Anda"
                          value={profileBioDraft}
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-foreground/76">
                          Avatar URL
                        </span>
                        <input
                          className="w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/45 focus:bg-card"
                          onChange={(event) =>
                            setProfileAvatarDraft(event.target.value)
                          }
                          placeholder="https://..."
                          value={profileAvatarDraft}
                        />
                      </label>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs uppercase tracking-[0.18em] text-foreground/35">
                          {profileBioDraft.length}/160
                        </span>
                        <Button
                          className="w-full rounded-full px-5 sm:w-auto"
                          disabled={updateProfileMutation.isPending}
                          type="submit"
                        >
                          {updateProfileMutation.isPending
                            ? "Menyimpan..."
                            : "Simpan profil"}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card className={surfaceClass}>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <p className="text-sm font-semibold text-foreground">
                {isOwnProfile ? "Post Anda" : "Post publik"}
              </p>
              {displayedProfilePosts.length === 0 ? (
                <EmptyState
                  title="Belum ada post"
                  description={
                    isOwnProfile
                      ? "Setelah Anda membuat post pertama, daftar post akan tampil rapi di profil ini."
                      : "User ini belum punya post publik untuk ditampilkan."
                  }
                />
              ) : (
                displayedProfilePosts.map((post) => (
                  <ProfilePostRow
                    key={post.id}
                    post={post}
                    deleting={
                      deletePostMutation.isPending &&
                      deletePostMutation.variables === post.id
                    }
                    isOwner={isOwnProfile}
                    onDelete={() => deletePostMutation.mutate(post.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (currentView === "more") {
      return (
        <div className="space-y-6">
          <SectionHeader
            title="Lainnya"
            description="Akses cepat ke pengaturan akun, keamanan, dan shortcut aplikasi."
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Card className={surfaceClass}>
              <CardContent className="space-y-4 p-5">
                <p className="text-sm font-semibold text-foreground">Akun</p>
                <ActionRow
                  title="Lihat profil"
                  description="Buka halaman profil dan ringkasan aktivitas Anda."
                  onClick={() => openProfile()}
                />
                <ActionRow
                  title="Tulis post baru"
                  description="Masuk ke composer khusus untuk membuat post."
                  onClick={() => setCurrentView("create")}
                />
                <ActionRow
                  title="Cari akun lain"
                  description="Temukan user lain dari jaringan RedPulse."
                  onClick={() => setCurrentView("search")}
                />
                <ActionRow
                  title="Post tersimpan"
                  description="Buka kumpulan bookmark post yang ingin Anda lihat lagi."
                  onClick={() => setCurrentView("saved")}
                />
              </CardContent>
            </Card>

            <Card className={surfaceClass}>
              <CardContent className="space-y-4 p-5">
                <p className="text-sm font-semibold text-foreground">Keamanan</p>
                <InfoRow
                  title="Metode login"
                  value={
                    currentUser?.email
                      ? "Google atau akun RedPulse"
                      : "Belum tersedia"
                  }
                />
                <InfoRow
                  title="Email akun"
                  value={currentUser?.email ?? "Belum tersedia"}
                />
                <InfoRow title="Status sesi" value="Aktif di browser ini" />
              </CardContent>
            </Card>
          </div>

          <Card className={surfaceClass}>
            <CardContent className="space-y-4 p-5">
              <p className="text-sm font-semibold text-foreground">Shortcut</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ShortcutCard
                  label="Jelajahi feed"
                  onClick={() => setCurrentView("explore")}
                />
                <ShortcutCard
                  label="Buka pesan"
                  onClick={() => setCurrentView("messages")}
                />
                <ShortcutCard
                  label="Lihat notifikasi"
                  onClick={() => setCurrentView("notifications")}
                />
                <ShortcutCard
                  label="Post tersimpan"
                  onClick={() => setCurrentView("saved")}
                />
                <ShortcutCard
                  label="Keluar dari akun"
                  onClick={() => logoutMutation.mutate()}
                  danger
                />
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4 md:space-y-6">
        <section
          className={cn(
            "rounded-[22px] border p-4 shadow-[0_12px_36px_rgba(0,0,0,0.12)] lg:hidden",
            surfaceClass,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className={cn(
                  "text-xs font-semibold uppercase tracking-[0.22em]",
                  faintTextClass,
                )}
              >
                Beranda
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-foreground">
                Halo, @{currentUser!.username}
              </h2>
              <p className={cn("mt-2 text-sm leading-6", subtleTextClass)}>
                Lihat update terbaru, bagikan momen, dan bangun percakapan dari
                satu layar yang ringkas.
              </p>
            </div>
            <Avatar
              username={currentUser!.username}
              avatarUrl={currentUser!.avatarUrl}
              size="md"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatCard label="Posts" value={profileSummary?.postsCount ?? 0} />
            <StatCard
              label="Followers"
              value={profileSummary?.followersCount ?? 0}
            />
            <StatCard
              label="Following"
              value={profileSummary?.followingCount ?? 0}
            />
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1 rounded-full"
              size="sm"
              onClick={() => setCurrentView("create")}
            >
              Buat post
            </Button>
            <Button
              className="flex-1 rounded-full"
              size="sm"
              variant="outline"
              onClick={() => setCurrentView("search")}
            >
              Cari akun
            </Button>
          </div>

          <div className="mt-3 flex gap-2 lg:hidden">
            <Button
              className="flex-1 rounded-full"
              size="sm"
              variant="ghost"
              onClick={() => setCurrentView("more")}
            >
              <Menu className="mr-2 h-4 w-4" />
              Lainnya
            </Button>
            <Button
              className="flex-1 rounded-full"
              size="sm"
              variant="ghost"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? "Keluar..." : "Logout"}
            </Button>
          </div>
        </section>

        <section className="border-b border-border pb-4">
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <div>
              <p className="text-sm font-semibold text-foreground">Stories</p>
              <p className="text-xs text-foreground/45">
                Akun yang aktif hari ini
              </p>
            </div>
            <button
              className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/40 transition hover:text-foreground"
              onClick={() => setCurrentView("search")}
              type="button"
            >
              Cari
            </button>
          </div>
          <div className="hide-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:gap-4 md:px-0">
            {storyUsers.length > 0 ? (
              storyUsers.map((user, index) => (
                <StoryBubble
                  key={user.id}
                  username={user.username}
                  avatarUrl={user.avatarUrl}
                  subtitle={index === 0 ? "Anda" : user.subtitle}
                />
              ))
            ) : (
              <div className="rounded-[22px] bg-card/60 px-4 py-4 text-sm leading-7 text-foreground/55">
                Stories akan mulai terisi saat akun lain ikut aktif. Untuk
                sekarang, Anda bisa memulai timeline dari post pertama.
              </div>
            )}
          </div>
        </section>
        {renderComposer()}
        <FeedList
          scope="following"
          canLike={true}
          currentUserId={currentUser?.id}
          onCreateFirstPost={() => setCurrentView("create")}
          onOpenExplore={() => setCurrentView("explore")}
          onOpenProfile={openProfile}
        />
      </div>
    );
  }

  function renderRightAside() {
    if (!currentUser) {
      return null;
    }

    if (currentView === "messages") {
      return (
        <div className="space-y-4">
          <CardTitle className={cn("text-base", panelHeadingClass)}>
            Quick links
          </CardTitle>
          <button
            className={utilityButtonClass}
            onClick={() => setCurrentView("search")}
            type="button"
          >
            Cari user lain
          </button>
          <button
            className={utilityButtonClass}
            onClick={() => openProfile()}
            type="button"
          >
            Buka profil Anda
          </button>
        </div>
      );
    }

    if (currentView === "profile") {
      return (
        <div className="space-y-4">
          <CardTitle className={cn("text-base", panelHeadingClass)}>
            Aksi cepat
          </CardTitle>
          <button
            className={utilityButtonClass}
            onClick={() => setCurrentView("create")}
            type="button"
          >
            Tulis post baru
          </button>
          <button
            className={utilityButtonClass}
            onClick={() => setCurrentView("saved")}
            type="button"
          >
            Buka post tersimpan
          </button>
          <button
            className={utilityButtonClass}
            onClick={() => setCurrentView("saved")}
            type="button"
          >
            Lihat post tersimpan
          </button>
          <button
            className={utilityButtonClass}
            onClick={() => setCurrentView("home")}
            type="button"
          >
            Kembali ke beranda
          </button>
        </div>
      );
    }

    if (currentView === "more") {
      return (
        <div className="space-y-4">
          <CardTitle className={cn("text-base", panelHeadingClass)}>
            Ringkasan akun
          </CardTitle>
          <div className={softPanelClass}>
            Gunakan halaman ini untuk lompat cepat ke profil, composer,
            pencarian user, post tersimpan, dan kontrol sesi akun Anda.
          </div>
          {profileSummary ? (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Posts" value={profileSummary.postsCount} />
              <StatCard
                label="Followers"
                value={profileSummary.followersCount}
              />
              <StatCard
                label="Following"
                value={profileSummary.followingCount}
              />
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center gap-3">
          <Avatar
            username={currentUser.username}
            avatarUrl={currentUser.avatarUrl}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">
              @{currentUser.username}
            </p>
            <p className="truncate text-sm text-foreground/50">
              {profileSummary?.bio ??
                "Masuk dengan Google dan mulai bangun jaringan Anda."}
            </p>
          </div>
          <button
            className="text-sm font-semibold text-primary"
            onClick={() => openProfile()}
            type="button"
          >
            Akun
          </button>
        </div>

        {profileSummary ? (
          <div className="grid grid-cols-3 gap-3 border-b border-border pb-6">
            <StatCard label="Posts" value={profileSummary.postsCount} />
            <StatCard label="Followers" value={profileSummary.followersCount} />
            <StatCard label="Following" value={profileSummary.followingCount} />
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className={cn("text-base", panelHeadingClass)}>
              Teman dekat untuk Anda
            </CardTitle>
            <button
              className="text-sm font-semibold text-foreground/70"
              onClick={() => setCurrentView("search")}
              type="button"
            >
              Lihat semua
            </button>
          </div>
          <div className="space-y-4">
            {suggestedUsersQuery.isLoading ? (
              <div className="text-sm text-foreground/50">
                Mencari akun untuk Anda...
              </div>
            ) : suggestions.length === 0 ? (
              <div className={cn("space-y-3", softPanelClass)}>
                <p className="text-sm font-semibold text-foreground">
                  Jaringan Anda masih baru
                </p>
                <p className="text-sm leading-6 text-foreground/52">
                  Saat akun lain mendaftar, rekomendasi follow akan muncul di
                  sini. Untuk sekarang, isi feed Anda dulu dan bangun profil
                  yang enak dilihat.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentView("create")}
                  >
                    Buat post
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openProfile()}
                  >
                    Rapikan profil
                  </Button>
                </div>
              </div>
            ) : (
              suggestions.map((user) => (
                <SuggestedUserRow
                  key={user.id}
                  user={user}
                  disabled={
                    followMutation.isPending &&
                    followMutation.variables === user.id
                  }
                  onFollow={() => {
                    followMutation.mutate(user.id);
                  }}
                  onOpenProfile={openProfile}
                />
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className={cn("text-base", panelHeadingClass)}>
              Topik yang mulai ramai
            </CardTitle>
          </div>
          {trendingTopics.length > 0 ? (
            <div className="space-y-3">
              {trendingTopics.map((topic) => (
                <button
                  key={topic.label}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[22px] border px-4 py-3 text-left transition hover:-translate-y-0.5",
                    softSurfaceClass,
                    isLightTheme ? "hover:bg-black/[0.05]" : "hover:bg-white/[0.04]",
                  )}
                  onClick={() => {
                    setSearchQuery(topic.label);
                    setCurrentView("search");
                  }}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-card text-primary">
                      <Hash className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {topic.label}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-foreground/32">
                        {topic.count} post
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-foreground/42">
                    Lihat
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={softPanelClass}>
              Begitu user mulai memakai hashtag seperti{" "}
              <span className="font-semibold text-foreground">#update</span>{" "}
              atau{" "}
              <span className="font-semibold text-foreground">#launch</span>, topik
              ramai akan muncul otomatis di sini.
            </div>
          )}
        </section>
      </>
    );
  }

  if (restoringSession) {
    return (
      <main className={cn("min-h-screen", shellClass)}>
        <section className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="flex justify-center">
              <Logo />
            </div>
            <div className="rounded-[28px] border border-border bg-card/85 p-8 shadow-[0_20px_54px_rgba(0,0,0,0.12)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Loader className="h-6 w-6 animate-spin" />
              </div>
              <h1 className="mt-5 text-2xl font-black tracking-tight text-foreground">
                Memulihkan sesi Anda
              </h1>
              <p className="mt-3 text-sm leading-7 text-foreground/58">
                RedPulse sedang memastikan akun Anda tetap masuk dengan aman.
                Halaman utama akan terbuka sebentar lagi.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <main
        className={cn(
          "mx-auto grid min-h-screen w-full max-w-[1400px] lg:grid-cols-[1.1fr_0.9fr]",
          shellClass,
        )}
      >
        <section className="hidden border-r border-border lg:flex">
          <div className="flex w-full flex-col justify-between px-12 py-14 xl:px-16">
            <div className="space-y-10">
              <div className="flex items-center justify-between gap-4">
                <Logo />
                <ThemeToggle
                  themeMode={themeMode}
                  onToggle={() => setThemeMode(isLightTheme ? "dark" : "light")}
                />
              </div>
              <div className="max-w-2xl space-y-6">
                <h1 className="text-5xl font-black leading-tight tracking-tight text-foreground xl:text-6xl">
                  Social media yang lebih bersih, lebih fokus, dan enak dipakai
                  setiap hari.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-foreground/65">
                  Masuk dengan Google, ikuti akun lain, bagikan update, dan
                  nikmati feed yang terasa modern tanpa layout yang terlalu
                  ramai.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 border-t border-border pt-6 text-sm text-foreground/38">
              <span>Google Login</span>
              <span>Real Feed</span>
              <span>Minimal UI</span>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8">
          <div className="w-full max-w-md space-y-5">
            <div className="flex items-center justify-between lg:hidden">
              <Logo compact />
              <ThemeToggle
                themeMode={themeMode}
                onToggle={() => setThemeMode(isLightTheme ? "dark" : "light")}
              />
            </div>

            <Card className="p-0">
              <CardContent className="space-y-8 p-7 sm:p-8">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">
                    Welcome to RedPulse
                  </p>
                  <h2 className="text-3xl font-black tracking-tight text-foreground">
                    Masuk untuk lanjut
                  </h2>
                  <p className="text-sm leading-7 text-foreground/62">
                    Halaman utama dikunci sampai user login. Anda bisa lanjut
                    dengan Google atau pakai akun RedPulse biasa.
                  </p>
                </div>

                {authLoading ? (
                  <div className="rounded-full border border-border bg-card/70 px-4 py-3 text-center text-sm text-foreground/68">
                    <Loader className="mx-auto h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : googleClientId ? (
                  <div className="space-y-3">
                    <div className="flex justify-center rounded-[26px] border border-border bg-card/60 px-4 py-4">
                      <GoogleSignInButton
                        clientId={googleClientId}
                        disabled={googleLoginMutation.isPending || authLocked}
                        onCredential={(credential) => {
                          setAuthError(null);
                          googleLoginMutation.mutate(
                            { credential },
                            {
                              onError: handleGoogleError,
                            },
                          );
                        }}
                      />
                    </div>
                    <p className="text-center text-xs leading-6 text-foreground/35">
                      {authLocked
                        ? `Login dikunci sementara. Coba lagi dalam ${authCooldownSeconds} detik.`
                        : "Jika popup Google ditutup atau gagal, coba lagi sekali dari tombol yang sama."}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                    Google login belum siap di frontend. Pastikan
                    `GOOGLE_CLIENT_ID` terbaca oleh server.
                  </div>
                )}

                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-foreground/28">
                  <div className="h-px flex-1 bg-border" />
                  <span>atau</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="grid grid-cols-2 rounded-full border border-border bg-card/80 p-1">
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      authMode === "login"
                        ? "bg-foreground text-background"
                        : "text-foreground/65 hover:text-foreground"
                    }`}
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError(null);
                    }}
                    type="button"
                  >
                    Login
                  </button>
                  <button
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      authMode === "register"
                        ? "bg-foreground text-background"
                        : "text-foreground/65 hover:text-foreground"
                    }`}
                    onClick={() => {
                      setAuthMode("register");
                      setAuthError(null);
                    }}
                    type="button"
                  >
                    Buat akun
                  </button>
                </div>

                {authMode === "login" ? (
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setAuthError(null);
                      if (authLocked) {
                        return;
                      }
                      loginMutation.mutate(loginForm, {
                        onError: handleAuthError,
                      });
                    }}
                  >
                    <div className="space-y-3">
                      <AuthInput
                        autoComplete="username"
                        label="Email atau username"
                        onChange={(value) =>
                          setLoginForm((current) => ({
                            ...current,
                            identifier: value,
                          }))
                        }
                        placeholder="nama@contoh.com atau username"
                        value={loginForm.identifier}
                      />
                      <AuthInput
                        autoComplete="current-password"
                        label="Password"
                        onChange={(value) =>
                          setLoginForm((current) => ({
                            ...current,
                            password: value,
                          }))
                        }
                        placeholder="Masukkan password"
                        type="password"
                        value={loginForm.password}
                      />
                    </div>

                    <Button
                      className="w-full"
                      disabled={loginMutation.isPending || authLocked}
                      type="submit"
                    >
                      {loginMutation.isPending
                        ? "Masuk..."
                        : authLocked
                          ? `Coba lagi ${authCooldownSeconds} dtk`
                          : "Login ke akun"}
                    </Button>
                  </form>
                ) : (
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setAuthError(null);
                      if (authLocked) {
                        return;
                      }
                      registerMutation.mutate(registerForm, {
                        onError: handleAuthError,
                      });
                    }}
                  >
                    <div className="space-y-3">
                      <AuthInput
                        autoComplete="username"
                        label="Username"
                        onChange={(value) =>
                          setRegisterForm((current) => ({
                            ...current,
                            username: value,
                          }))
                        }
                        placeholder="username"
                        value={registerForm.username}
                      />
                      <AuthInput
                        autoComplete="email"
                        label="Email"
                        onChange={(value) =>
                          setRegisterForm((current) => ({
                            ...current,
                            email: value,
                          }))
                        }
                        placeholder="nama@contoh.com"
                        type="email"
                        value={registerForm.email}
                      />
                      <AuthInput
                        autoComplete="new-password"
                        label="Password"
                        onChange={(value) =>
                          setRegisterForm((current) => ({
                            ...current,
                            password: value,
                          }))
                        }
                        placeholder="Minimal 8 karakter"
                        type="password"
                        value={registerForm.password}
                      />
                    </div>

                    <Button
                      className="w-full"
                      disabled={registerMutation.isPending || authLocked}
                      type="submit"
                    >
                      {registerMutation.isPending
                        ? "Membuat akun..."
                        : authLocked
                          ? `Coba lagi ${authCooldownSeconds} dtk`
                          : "Buat akun baru"}
                    </Button>
                  </form>
                )}

                {authError ? (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    <div className="space-y-1">
                      <p>{authError}</p>
                      {authLocked ? (
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-red-100/80">
                          Coba lagi dalam {authCooldownSeconds} detik
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <p className="text-center text-xs leading-6 text-foreground/35">
              UI dibuat fokus ke konten utama dan flow login, bukan penuh panel
              dekoratif.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const authenticatedUser = currentUser;

  return (
    <main
      className={cn(
        "mx-auto grid min-h-screen w-full max-w-[1480px] gap-4 px-3 py-3 pb-24 md:gap-6 md:px-4 md:py-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:pb-4 xl:grid-cols-[220px_minmax(0,680px)_300px] xl:px-6",
        shellClass,
      )}
    >
      <aside className="hidden lg:block">
        <div className="sticky top-0 flex min-h-[calc(100vh-2rem)] flex-col justify-between py-3">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-3 px-2">
              <Logo />
              <div className="flex items-center gap-2">
                <NotificationIconButton
                  count={unreadNotifications}
                  onClick={() => setCurrentView("notifications")}
                />
                <ThemeToggle
                  themeMode={themeMode}
                  onToggle={() => setThemeMode(isLightTheme ? "dark" : "light")}
                />
              </div>
            </div>

            <nav className="space-y-2">
              <SidebarItem
                icon={Home}
                label="Beranda"
                active={currentView === "home"}
                onClick={() => setCurrentView("home")}
              />
              <SidebarItem
                icon={Search}
                label="Cari"
                active={currentView === "search"}
                onClick={() => setCurrentView("search")}
              />
              <SidebarItem
                icon={Compass}
                label="Jelajahi"
                active={currentView === "explore"}
                onClick={() => setCurrentView("explore")}
              />
              <SidebarItem
                icon={Send}
                label="Pesan"
                active={currentView === "messages"}
                onClick={() => setCurrentView("messages")}
              />
              <SidebarItem
                badgeCount={unreadNotifications}
                icon={Bell}
                label="Notifikasi"
                active={currentView === "notifications"}
                onClick={() => setCurrentView("notifications")}
              />
              <SidebarItem
                icon={PlusSquare}
                label="Buat"
                active={currentView === "create"}
                onClick={() => setCurrentView("create")}
              />
              <SidebarItem
                icon={UserRound}
                label="Profil"
                active={currentView === "profile"}
                onClick={() => openProfile()}
              />
            </nav>
          </div>

          <div className="space-y-3">
            <div
              className={cn(
                "flex items-center gap-3 rounded-[24px] border px-4 py-4",
                softSurfaceClass,
              )}
            >
              <Avatar
                username={authenticatedUser.username}
                avatarUrl={authenticatedUser.avatarUrl}
                size="md"
              />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  @{authenticatedUser.username}
                </p>
                <p className="truncate text-sm text-foreground/50">
                  {authenticatedUser.email}
                </p>
              </div>
            </div>

            <Button
              className="w-full justify-start rounded-2xl"
              variant="outline"
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? "Signing out..." : "Keluar"}
            </Button>

            <button
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                currentView === "more"
                  ? "bg-foreground/6 text-foreground"
                  : "text-foreground/65 hover:bg-foreground/4"
              }`}
              onClick={() => setCurrentView("more")}
              type="button"
            >
              <Menu className="h-4 w-4" />
              Lainnya
            </button>
          </div>
        </div>
      </aside>

      <section className="space-y-4 md:space-y-6">
        {renderMainContent()}
      </section>

      <aside className="hidden xl:block">
        <div className="sticky top-6 space-y-6">
          {renderRightAside()}

          <section className="space-y-3 border-t border-border pt-5 text-sm text-foreground/38">
            <p className="leading-6">
              Tentang . Bantuan . API . Privasi . Ketentuan . Lokasi . Bahasa
            </p>
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/22">
              Copyright 2026 RedPulse
            </p>
          </section>
        </div>
      </aside>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t px-2 py-2 backdrop-blur lg:hidden",
          navChromeClass,
        )}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-1">
          <MobileNavItem
            icon={Home}
            label="Home"
            active={currentView === "home"}
            onClick={() => setCurrentView("home")}
          />
          <MobileNavItem
            icon={Search}
            label="Cari"
            active={currentView === "search"}
            onClick={() => setCurrentView("search")}
          />
          <MobileNavItem
            icon={PlusSquare}
            label="Buat"
            active={currentView === "create"}
            onClick={() => setCurrentView("create")}
          />
          <MobileNavItem
            icon={Send}
            label="Pesan"
            active={currentView === "messages"}
            onClick={() => setCurrentView("messages")}
          />
          <MobileNavItem
            icon={UserRound}
            label="Profil"
            active={currentView === "profile"}
            onClick={() => openProfile()}
          />
        </div>
      </nav>

      <div className="fixed right-4 top-4 z-30 flex items-center gap-2 lg:hidden">
        <NotificationIconButton
          count={unreadNotifications}
          onClick={() => setCurrentView("notifications")}
        />
        <ThemeToggle
          themeMode={themeMode}
          onToggle={() => setThemeMode(isLightTheme ? "dark" : "light")}
        />
      </div>
    </main>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  badgeCount = 0,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  badgeCount?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-foreground/6 text-foreground"
          : "text-foreground/72 hover:bg-foreground/4 hover:text-foreground"
      }`}
    >
      <div className="relative">
        <Icon
          className={`h-4 w-4 ${active ? "text-primary" : "text-foreground/62"}`}
        />
        {badgeCount > 0 ? (
          <span className="absolute -right-2.5 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-black">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        ) : null}
      </div>
      <span>{label}</span>
    </button>
  );
}

function MobileNavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition ${
        active ? "bg-foreground/6 text-foreground" : "text-foreground/45"
      }`}
    >
      <Icon
        className={`h-4 w-4 ${active ? "text-primary" : "text-foreground/55"}`}
      />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-[28px] font-black tracking-tight text-foreground md:text-[32px]">
        {title}
      </h2>
      <p className="max-w-2xl text-sm leading-7 text-foreground/55">
        {description}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-card/70 p-5">
      <div className="animate-soft-float flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary shadow-[0_14px_30px_rgba(255,0,0,0.08)]">
        <SparkleDot />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-7 text-foreground/55">{description}</p>
    </div>
  );
}

function getRelativeActivityTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}j`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}h`;
}

function NotificationIconButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/85 text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:bg-card"
      onClick={onClick}
      type="button"
    >
      <Bell className="h-4 w-4 text-primary" />
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-black leading-none text-black">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </button>
  );
}

function NotificationBadgeButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card/75 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/62 transition hover:bg-card"
      onClick={onClick}
      type="button"
    >
      <Bell className="h-3.5 w-3.5 text-primary" />
      <span>{count > 0 ? `${count} baru` : "sinkron"}</span>
    </button>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-4 transition",
        notification.readAt
          ? "border-border bg-card/55"
          : "border-primary/20 bg-primary/5 shadow-[0_14px_28px_rgba(255,0,0,0.06)]",
      )}
    >
      <div className="flex items-start gap-3">
        {notification.actor ? (
          <Avatar
            avatarUrl={notification.actor.avatarUrl}
            size="md"
            username={notification.actor.username}
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card/80 text-primary">
            <Bell className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {notification.message}
            </p>
            {!notification.readAt ? (
              <span className="rounded-full bg-primary/12 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                Baru
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-foreground/40">
            <span>{notification.type}</span>
            <span>•</span>
            <span>{getRelativeActivityTime(notification.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionRow({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full rounded-2xl border border-border bg-card/60 px-4 py-4 text-left transition hover:bg-card"
      onClick={onClick}
      type="button"
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-foreground/55">{description}</p>
    </button>
  );
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-foreground/38">
        {title}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ShortcutCard({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className={`rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition ${
        danger
          ? "border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/15"
          : "border-border bg-card/60 text-foreground/75 hover:bg-card"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ProfilePostRow({
  post,
  isOwner = false,
  deleting = false,
  onDelete,
}: {
  post: FeedPost;
  isOwner?: boolean;
  deleting?: boolean;
  onDelete?: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) {
      return;
    }

    const timeout = window.setTimeout(() => setConfirmDelete(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [confirmDelete]);

  return (
    <div className="rounded-[24px] border border-border bg-card/70 p-3.5 sm:p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/38">
            Post
          </p>
          <p className="mt-1 text-xs text-foreground/45">
            Tersimpan di profil Anda dan timeline publik.
          </p>
        </div>
        {isOwner ? (
          <Button
            className={cn(
              "w-full rounded-full border-red-500/25 bg-red-500/10 px-4 text-red-400 shadow-none hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-300 sm:w-auto",
              confirmDelete &&
                "border-red-500/55 bg-red-500 text-white hover:bg-[#ff1a1a]",
            )}
            disabled={deleting}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }

              onDelete?.();
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {deleting ? "Menghapus..." : confirmDelete ? "Ya, hapus" : "Hapus"}
          </Button>
        ) : null}
      </div>
      {post.media.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-[18px] border border-border bg-background">
          {post.media[0]?.type === "video" ? (
            <video
              className="max-h-56 w-full object-cover"
              controls
              playsInline
              preload="metadata"
              src={post.media[0].url}
            />
          ) : (
            <img
              alt={post.content ?? "Post media"}
              className="max-h-56 w-full object-cover"
              src={post.media[0]?.url}
            />
          )}
        </div>
      ) : null}
      <p className="text-sm leading-7 text-foreground/80">
        {post.content ?? "Post media tanpa caption."}
      </p>
      {post.location ? (
        <p className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-foreground/45">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {post.location}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-foreground/38">
        <span>{post.likeCount} pulse</span>
        <span>{post.type}</span>
      </div>
      {confirmDelete ? (
        <p className="mt-3 text-xs leading-6 text-red-300">
          Klik sekali lagi untuk menghapus post ini dari feed dan profil.
        </p>
      ) : null}
    </div>
  );
}

function Avatar({
  username,
  avatarUrl,
  size,
}: {
  username: string;
  avatarUrl?: string | null;
  size: "md" | "lg";
}) {
  const classes = size === "lg" ? "h-16 w-16 text-base" : "h-12 w-12 text-sm";

  if (avatarUrl) {
    return (
      <img
        alt={username}
        className={`${classes} shrink-0 rounded-full border border-border object-cover`}
        src={avatarUrl}
      />
    );
  }

  return (
    <div
      className={`flex ${classes} shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-bold text-primary`}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}

function StoryBubble({
  username,
  avatarUrl,
  subtitle,
}: {
  username: string;
  avatarUrl?: string | null;
  subtitle: string;
}) {
  return (
    <div className="min-w-[70px] space-y-2 text-center md:min-w-[76px]">
      <div className="mx-auto flex h-[66px] w-[66px] items-center justify-center rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(255,0,0,0.95)_0deg,rgba(255,112,0,0.9)_140deg,rgba(255,0,0,0.95)_360deg)] p-[2px] md:h-[74px] md:w-[74px]">
        <div className="flex h-full w-full items-center justify-center rounded-full bg-black p-[3px]">
          <Avatar username={username} avatarUrl={avatarUrl} size="md" />
        </div>
      </div>
      <div>
        <p className="truncate text-xs font-medium text-foreground">
          {username}
        </p>
        <p className="truncate text-[11px] text-foreground/38">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-border bg-card/60 p-3 text-center shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
      <div className="text-xl font-black tracking-tight text-foreground">
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-foreground/36">
        {label}
      </div>
    </div>
  );
}

function SuggestedUserRow({
  user,
  disabled,
  onFollow,
  onOpenProfile,
}: {
  user: Pick<
    NetworkUser,
    | "id"
    | "username"
    | "avatarUrl"
    | "bio"
    | "followersCount"
    | "mutualCount"
    | "postsCount"
    | "isFollowing"
  >;
  disabled: boolean;
  onFollow: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        className="shrink-0"
        onClick={() => onOpenProfile?.(user.id)}
        type="button"
      >
        <Avatar username={user.username} avatarUrl={user.avatarUrl} size="md" />
      </button>
      <div className="min-w-0 flex-1">
        <button
          className="truncate text-[15px] font-semibold tracking-tight text-foreground transition hover:text-primary"
          onClick={() => onOpenProfile?.(user.id)}
          type="button"
        >
          @{user.username}
        </button>
        <p className="truncate text-[12px] text-foreground/42">
          {user.bio ??
            (user.mutualCount && user.mutualCount > 0
              ? `${user.mutualCount} koneksi serupa · ${user.followersCount} followers`
              : `${user.followersCount} followers · ${user.postsCount} posts`)}
        </p>
      </div>
      <button
        className="text-sm font-semibold text-primary transition hover:text-foreground disabled:cursor-not-allowed disabled:text-foreground/25"
        disabled={disabled}
        onClick={onFollow}
        type="button"
      >
        {user.isFollowing ? "Batal mengikuti" : "Ikuti"}
      </button>
    </div>
  );
}

function AuthInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground/76">{label}</span>
      <input
        autoComplete={autoComplete}
        className="w-full rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/45 focus:bg-card"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}

function SparkleDot() {
  return (
    <div className="h-3.5 w-3.5 rounded-full bg-primary shadow-[0_0_20px_rgba(255,0,0,0.5)]" />
  );
}

function ThemeToggle({
  themeMode,
  onToggle,
}: {
  themeMode: ThemeMode;
  onToggle: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card/85 px-3 py-2 text-sm font-medium text-foreground shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:bg-card"
      onClick={onToggle}
      type="button"
    >
      {themeMode === "dark" ? (
        <SunMedium className="h-4 w-4 text-primary" />
      ) : (
        <MoonStar className="h-4 w-4 text-primary" />
      )}
    </button>
  );
}

import { useEffect, useMemo, useState } from "react";
import type {
  ConversationSummary,
  CreatePostInput,
  FeedPost,
  LoginInput,
  PublicProfile,
  RegisterInput,
  SuggestedUser
} from "@redpulse/validation";
import {
  Bell,
  Compass,
  Hash,
  Home,
  ImagePlus,
  Loader,
  LogOut,
  MapPin,
  Menu,
  Moon,
  MoonStar,
  PlusSquare,
  Search,
  Send,
  SmilePlus,
  Sun,
  SunMedium,
  TrendingUp,
  UserRound
} from "lucide-react";
import { Button, Card, CardContent, CardTitle, Logo, cn } from "@redpulse/ui";
import { ApiError } from "./lib/api";
import { GoogleSignInButton } from "./features/auth/google-sign-in-button";
import { FeedList } from "./features/feed/feed-list";
import {
  useConversationMessagesQuery,
  useConversationsQuery,
  useCreatePostMutation,
  useCurrentUserQuery,
  useGoogleConfigQuery,
  useGoogleLoginMutation,
  useLoginMutation,
  useLogoutMutation,
  usePostsQuery,
  useProfileSummaryQuery,
  usePublicProfileQuery,
  useRegisterMutation,
  useSendDirectMessageMutation,
  useSuggestedUsersQuery,
  useToggleFollowMutation
} from "./features/feed/hooks";

type AppView = "home" | "search" | "explore" | "messages" | "notifications" | "create" | "profile" | "more";
type ThemeMode = "dark" | "light";

type NetworkUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  followersCount: number;
  postsCount: number;
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
  location: ""
};
const initialLoginState: LoginInput = {
  identifier: "",
  password: ""
};
const initialRegisterState: RegisterInput = {
  username: "",
  email: "",
  password: ""
};
const featuredLocations = [
  "Makassar, Indonesia",
  "Jakarta, Indonesia",
  "Bandung, Indonesia",
  "Bali, Indonesia",
  "Surabaya, Indonesia",
  "Yogyakarta, Indonesia"
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

function buildNetworkUsers(currentUserId: string, suggestions: SuggestedUser[], posts: FeedPost[]) {
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
      isFollowing: user.isFollowing
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
      postsCount: posts.filter((item) => item.author.id === post.author.id).length,
      isFollowing: false
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

    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [postForm, setPostForm] = useState<CreatePostInput>(initialPostState);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [showLocationField, setShowLocationField] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [selectedMessageUserId, setSelectedMessageUserId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [loginForm, setLoginForm] = useState<LoginInput>(initialLoginState);
  const [registerForm, setRegisterForm] = useState<RegisterInput>(initialRegisterState);
  const [authError, setAuthError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const currentUserQuery = useCurrentUserQuery();
  const currentUser = currentUserQuery.data?.user ?? null;
  const profileSummaryQuery = useProfileSummaryQuery(Boolean(currentUser));
  const profileSummary = profileSummaryQuery.data?.profile ?? null;
  const publicProfileQuery = usePublicProfileQuery(
    currentUser && selectedProfileUserId && selectedProfileUserId !== currentUser.id ? selectedProfileUserId : null,
    Boolean(currentUser && selectedProfileUserId && selectedProfileUserId !== currentUser.id)
  );
  const suggestedUsersQuery = useSuggestedUsersQuery(Boolean(currentUser));
  const suggestions = suggestedUsersQuery.data?.users ?? [];
  const postsQuery = usePostsQuery();
  const conversationsQuery = useConversationsQuery(Boolean(currentUser));
  const googleConfigQuery = useGoogleConfigQuery();
  const isOwnProfile = !selectedProfileUserId || selectedProfileUserId === currentUser?.id;
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
          isFollowing: false
        }
      : publicProfileQuery.data?.profile ?? null;

  const logoutMutation = useLogoutMutation(() => {
    setPostForm(initialPostState);
    setMediaFiles([]);
    setShowLocationField(false);
    setSelectedProfileUserId(null);
    setSelectedConversationId(null);
    setSelectedMessageUserId(null);
    setMessageDraft("");
    setAuthError(null);
    setCurrentView("home");
  });

  const createPostMutation = useCreatePostMutation(() => {
    setPostForm(initialPostState);
    setMediaFiles([]);
    setShowLocationField(false);
    setPostError(null);
    setCurrentView("home");
  });
  const loginMutation = useLoginMutation(() => {
    setAuthError(null);
    setLoginForm(initialLoginState);
  });
  const registerMutation = useRegisterMutation(() => {
    setAuthError(null);
    setRegisterForm(initialRegisterState);
  });
  const googleLoginMutation = useGoogleLoginMutation(() => {
    setAuthError(null);
  });
  const sendDirectMessageMutation = useSendDirectMessageMutation((conversationId) => {
    setSelectedConversationId(conversationId);
    setMessageDraft("");
  });

  const followMutation = useToggleFollowMutation();
  const isLightTheme = themeMode === "light";
  const isAuthenticated = Boolean(currentUser);
  const authLoading = currentUserQuery.isLoading || googleConfigQuery.isLoading;
  const restoringSession = currentUserQuery.isLoading;
  const googleClientId = googleConfigQuery.data?.clientId ?? "";
  const allPosts = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const conversations = conversationsQuery.data?.conversations ?? [];
  const canSubmitPost = Boolean(postForm.content?.trim() || mediaFiles.length > 0);
  const mediaPreviews = useMemo(
    () =>
      mediaFiles.map((file) => ({
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file)
      })),
    [mediaFiles]
  );
  const trendingTopics = useMemo(() => {
    const topics = new Map<string, number>();

    for (const post of allPosts) {
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
        count
      }));
  }, [allPosts]);

  const storyUsers = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    const seen = new Set<string>();
    const feedAuthors =
      postsQuery.data?.pages
        .flatMap((page) => page.items)
        .map((post) => ({
          id: post.author.id,
          username: post.author.username,
          avatarUrl: post.author.avatarUrl,
          subtitle: "From your feed"
        })) ?? [];

    const suggestionAuthors = suggestions.map((user) => ({
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      subtitle: user.isFollowing ? "Following" : "Suggested"
    }));

    return [
      {
        id: currentUser.id,
        username: currentUser.username,
        avatarUrl: currentUser.avatarUrl,
        subtitle: "Your story"
      },
      ...feedAuthors,
      ...suggestionAuthors
    ].filter((user) => {
      if (seen.has(user.id)) {
        return false;
      }

      seen.add(user.id);
      return true;
    });
  }, [allPosts, currentUser, suggestions]);

  const networkUsers = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    return buildNetworkUsers(currentUser.id, suggestions, allPosts);
  }, [allPosts, currentUser, suggestions]);

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
          isFollowing: suggestions.find((user) => user.id === conversation.participant.id)?.isFollowing ?? false
        },
        conversationId: conversation.id,
        lastMessage: conversation.lastMessage?.content ?? null,
        updatedAt: conversation.updatedAt
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
        updatedAt: null
      });
    }

    return Array.from(map.values()).sort((left, right) => {
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;

      return rightTime - leftTime || left.user.username.localeCompare(right.user.username);
    });
  }, [conversations, networkUsers, suggestions]);

  const selectedThread = useMemo(() => {
    if (selectedConversationId) {
      return messageThreads.find((thread) => thread.conversationId === selectedConversationId) ?? null;
    }

    if (selectedMessageUserId) {
      return messageThreads.find((thread) => thread.user.id === selectedMessageUserId) ?? null;
    }

    return messageThreads[0] ?? null;
  }, [messageThreads, selectedConversationId, selectedMessageUserId]);

  const conversationMessagesQuery = useConversationMessagesQuery(
    selectedThread?.conversationId ?? null,
    Boolean(currentUser && selectedThread?.conversationId)
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
    () => allPosts.filter((post) => post.author.id === currentUser?.id),
    [allPosts, currentUser?.id]
  );
  const displayedProfilePosts = isOwnProfile ? profilePosts : publicProfileQuery.data?.posts ?? [];

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
    return () => {
      for (const preview of mediaPreviews) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [mediaPreviews]);

  function handlePostError(error: unknown) {
    if (error instanceof ApiError) {
      setPostError(error.message);
      return;
    }

    setPostError("Post gagal dikirim. Coba lagi sebentar.");
  }

  function handleAuthError(error: unknown) {
    if (error instanceof ApiError) {
      setAuthError(error.message);
      return;
    }

    setAuthError("Autentikasi gagal. Coba lagi sebentar.");
  }

  function handleGoogleError(error: unknown) {
    if (error instanceof ApiError) {
      setAuthError(error.message);
      return;
    }

    setAuthError("Login Google gagal. Coba lagi sebentar.");
  }

  function appendToComposer(token: string) {
    setPostForm((current) => ({
      ...current,
      content: `${current.content ?? ""}${token}`.slice(0, 280)
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

  const shellClass = isLightTheme
    ? "bg-[radial-gradient(circle_at_top,rgba(255,0,0,0.05),transparent_24%),linear-gradient(180deg,#fafafa_0%,#f3f4f6_100%)] text-slate-950"
    : "";
  const surfaceClass = isLightTheme ? "bg-white border-black/8 shadow-[0_18px_48px_rgba(15,23,42,0.08)]" : "bg-[#090909]";
  const softSurfaceClass = isLightTheme ? "border-black/8 bg-black/[0.03]" : "border-white/10 bg-white/[0.02]";
  const subtleTextClass = isLightTheme ? "text-slate-600" : "text-white/55";
  const faintTextClass = isLightTheme ? "text-slate-400" : "text-white/38";
  const navChromeClass = isLightTheme ? "border-black/8 bg-white/95" : "border-white/8 bg-black/95";

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
        <div className={cn("rounded-[24px] border p-3.5 shadow-[0_18px_46px_rgba(0,0,0,0.2)] md:rounded-[30px] md:p-5", surfaceClass)}>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setPostError(null);
              createPostMutation.mutate(
                {
                  content: postForm.content,
                  location: postForm.location,
                  files: mediaFiles
                },
                {
                  onError: handlePostError
                }
              );
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={cn("text-xs font-semibold uppercase tracking-[0.22em]", faintTextClass)}>Composer</p>
                <p className={cn("mt-1 text-xs md:text-sm", subtleTextClass)}>Bagikan update, foto, atau video ke feed Anda.</p>
              </div>
              <div className={cn("text-xs uppercase tracking-[0.18em]", faintTextClass)}>
                {mediaFiles.length > 0 ? `${mediaFiles.length}/4 media` : "Caption atau media"}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Avatar username={currentUser!.username} avatarUrl={currentUser!.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <textarea
                  className="min-h-24 w-full rounded-[18px] border border-border bg-background/70 px-3.5 py-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-ring/40 focus:bg-background md:min-h-28 md:rounded-[22px] md:px-4 md:py-4"
                  maxLength={280}
                  onChange={(event) => setPostForm((current) => ({ ...current, content: event.target.value }))}
                  placeholder="Apa yang sedang Anda pikirkan hari ini?"
                  value={postForm.content ?? ""}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className={cn("text-xs md:text-sm", subtleTextClass)}>
                Posting sebagai <span className="font-semibold text-foreground">@{currentUser!.username}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-xs md:text-sm", subtleTextClass)}>{postForm.content?.length ?? 0}/280</span>
                <Button type="submit" disabled={createPostMutation.isPending || !canSubmitPost} className="rounded-full px-5">
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
                    const selectedFiles = Array.from(event.target.files ?? []).slice(0, 4);
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
                {postForm.location?.trim() ? postForm.location : "Tambah lokasi"}
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
                        <video className="h-full w-full object-cover" controls muted playsInline src={preview.url} />
                      ) : (
                        <img alt={preview.name} className="h-full w-full object-cover" src={preview.url} />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <p className="truncate text-sm text-foreground/62">{preview.name}</p>
                      <button
                        className="text-xs font-semibold text-primary"
                        onClick={() => setMediaFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}
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
                    <p className="text-sm font-semibold text-foreground">Lokasi post</p>
                    <p className="mt-1 text-xs text-foreground/45">Tambahkan kota, venue, atau area supaya post terasa lebih hidup.</p>
                  </div>
                  {postForm.location?.trim() ? (
                    <button
                      className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/40 transition hover:text-foreground"
                      onClick={() => setPostForm((current) => ({ ...current, location: "" }))}
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
                  onChange={(event) => setPostForm((current) => ({ ...current, location: event.target.value }))}
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
                          : "border-border bg-background/55 text-foreground/65 hover:bg-card hover:text-foreground"
                      )}
                      onClick={() => setPostForm((current) => ({ ...current, location }))}
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
          <SectionHeader title="Cari akun" description="Temukan akun lain berdasarkan username atau bio." />
          <Card className={surfaceClass}>
            <CardContent className="space-y-4 p-5">
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-primary/45"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Cari username atau bio"
                value={searchQuery}
              />
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <EmptyState title="Tidak ada hasil" description="Belum ada akun yang cocok dengan pencarian Anda." />
                ) : (
                  filteredUsers.map((user) => (
                    <SuggestedUserRow
                      key={user.id}
                      user={user}
                      disabled={followMutation.isPending && followMutation.variables === user.id}
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
          <SectionHeader title="Jelajahi" description="Lihat post publik terbaru dan akun yang sedang aktif di RedPulse." />
          <FeedList canLike={true} onCreateFirstPost={() => setCurrentView("create")} onOpenProfile={openProfile} />
        </div>
      );
    }

    if (currentView === "messages") {
      return (
        <div className="space-y-6">
          <SectionHeader title="Pesan" description="DM satu-satu sekarang aktif. Pilih user lalu kirim pesan langsung dari sini." />
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <Card className={cn(surfaceClass, "p-0")}>
              <CardContent className="space-y-2 p-3">
                {messageThreads.length === 0 ? (
                  <EmptyState
                    title="Belum ada percakapan"
                    description="Saat ada akun lain di jaringan Anda, daftar percakapan akan muncul di sini."
                  />
                ) : (
                  messageThreads.map((thread) => (
                    <div
                      key={thread.user.id}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        selectedMessageUser?.id === thread.user.id
                          ? "bg-white/[0.06] text-white"
                          : "text-white/70 hover:bg-white/[0.03] hover:text-white"
                      }`}
                    >
                      <button className="shrink-0" onClick={() => openProfile(thread.user.id)} type="button">
                        <Avatar username={thread.user.username} avatarUrl={thread.user.avatarUrl} size="md" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          className="block truncate text-left text-sm font-semibold text-white transition hover:text-primary"
                          onClick={() => openProfile(thread.user.id)}
                          type="button"
                        >
                          @{thread.user.username}
                        </button>
                        <p className="truncate text-xs text-white/42">{thread.lastMessage ?? thread.user.bio ?? "Mulai percakapan baru."}</p>
                        <button
                          className="mt-2 text-xs font-medium text-white/55 transition hover:text-white"
                          onClick={() => openMessages(thread.user.id, thread.conversationId)}
                          type="button"
                        >
                          {thread.conversationId ? "Buka percakapan" : "Kirim pesan"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className={surfaceClass}>
              <CardContent className="space-y-5 p-5">
                {selectedMessageUser ? (
                  <>
                    <div className="flex items-center gap-3">
                      <Avatar username={selectedMessageUser.username} avatarUrl={selectedMessageUser.avatarUrl} size="md" />
                      <div>
                        <p className="font-semibold text-white">@{selectedMessageUser.username}</p>
                        <p className="text-sm text-white/45">{selectedMessageUser.bio ?? "Siap untuk terhubung."}</p>
                      </div>
                    </div>
                    <div className="space-y-3 rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
                      {conversationMessagesQuery.isLoading && selectedThread?.conversationId ? (
                        <div className="flex items-center gap-3 text-sm text-white/62">
                          <Loader className="h-4 w-4 animate-spin text-primary" />
                          Memuat percakapan...
                        </div>
                      ) : conversationMessagesQuery.data?.messages.length ? (
                        <div className="space-y-3">
                          {conversationMessagesQuery.data.messages.map((message) => {
                            const mine = message.senderId === currentUser!.id;

                            return (
                              <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                                <div
                                  className={cn(
                                    "max-w-[85%] rounded-[22px] px-4 py-3 text-sm leading-7",
                                    mine ? "bg-primary text-black" : "bg-white/[0.05] text-white/78"
                                  )}
                                >
                                  <p>{message.content}</p>
                                  <p className={cn("mt-2 text-[11px]", mine ? "text-black/60" : "text-white/38")}>
                                    {new Date(message.createdAt).toLocaleString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      day: "2-digit",
                                      month: "short"
                                    })}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm leading-7 text-white/62">
                          Belum ada pesan dengan @{selectedMessageUser.username}. Kirim pesan pertama untuk memulai percakapan.
                        </div>
                      )}
                    </div>
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();

                        if (!messageDraft.trim()) {
                          return;
                        }

                        sendDirectMessageMutation.mutate({
                          userId: selectedMessageUser.id,
                          input: {
                            content: messageDraft.trim()
                          }
                        });
                      }}
                    >
                      <textarea
                        className="min-h-24 w-full rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-primary/45"
                        onChange={(event) => setMessageDraft(event.target.value)}
                        placeholder={`Kirim pesan ke @${selectedMessageUser.username}`}
                        value={messageDraft}
                      />
                      <div className="flex gap-3">
                        <Button type="submit" disabled={sendDirectMessageMutation.isPending || !messageDraft.trim()}>
                          {sendDirectMessageMutation.isPending ? "Mengirim..." : "Kirim pesan"}
                        </Button>
                        <Button variant="outline" onClick={() => openProfile(selectedMessageUser.id)} type="button">
                          Buka profil
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <EmptyState title="Belum ada user" description="Daftar pesan akan aktif setelah ada akun lain yang bisa Anda pilih." />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    if (currentView === "notifications") {
      const notices = [
        profileSummary
          ? `Akun Anda punya ${profileSummary.followersCount} followers dan ${profileSummary.followingCount} following.`
          : null,
        suggestions.length > 0 ? `Ada ${suggestions.length} akun yang bisa Anda ikuti sekarang.` : null,
        allPosts.length > 0 ? `Feed publik saat ini memuat ${allPosts.length} post terbaru.` : null
      ].filter(Boolean) as string[];

      return (
        <div className="space-y-6">
          <SectionHeader title="Notifikasi" description="Ringkasan aktivitas akun dan update penting di aplikasi." />
          <Card className={surfaceClass}>
            <CardContent className="space-y-4 p-5">
              {notices.length === 0 ? (
                <EmptyState
                  title="Belum ada notifikasi"
                  description="Saat akun mulai aktif dan jaringan Anda tumbuh, notifikasi akan muncul di sini."
                />
              ) : (
                notices.map((notice) => (
                  <div key={notice} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-white/72">
                    {notice}
                  </div>
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
          <SectionHeader title="Buat post" description="Tulis update baru dan kirim langsung ke feed publik Anda." />
          {renderComposer()}
          <Card className={surfaceClass}>
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-semibold text-white">Tips cepat</p>
              <p className="text-sm leading-7 text-white/60">
                Tulis singkat, jelas, dan fokus. Setelah post terkirim, Anda akan langsung dibawa kembali ke beranda.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (currentView === "profile") {
      const profileTitle = isOwnProfile ? "Profil" : `@${activeProfile?.username ?? "profil"}`;
      const profileDescription = isOwnProfile
        ? "Ringkasan akun Anda dan post yang sudah dipublikasikan."
        : "Lihat profil publik user lain, lengkap dengan post yang sudah mereka bagikan.";

      return (
        <div className="space-y-6">
          <SectionHeader title={profileTitle} description={profileDescription} />
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
              <CardContent className="p-5 text-sm text-red-400">Profil user ini belum bisa dimuat sekarang.</CardContent>
            </Card>
          ) : null}
          <Card className={surfaceClass}>
            <CardContent className="space-y-5 p-5">
              <div className="flex items-center gap-4">
                <Avatar
                  username={activeProfile?.username ?? (isOwnProfile ? currentUser!.username : "RP")}
                  avatarUrl={activeProfile?.avatarUrl ?? (isOwnProfile ? currentUser!.avatarUrl : null)}
                  size="lg"
                />
                <div className="min-w-0">
                  <p className="text-xl font-semibold text-white">
                    @{activeProfile?.username ?? (isOwnProfile ? currentUser!.username : "profil")}
                  </p>
                  <p className="text-sm text-white/50">
                    {isOwnProfile ? currentUser!.email : "Profil publik RedPulse"}
                  </p>
                  <p className="mt-2 text-sm text-white/60">
                    {activeProfile?.bio ?? "Belum ada bio untuk akun ini."}
                  </p>
                </div>
              </div>
              {activeProfile ? (
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Posts" value={activeProfile.postsCount} />
                  <StatCard label="Followers" value={activeProfile.followersCount} />
                  <StatCard label="Following" value={activeProfile.followingCount} />
                </div>
              ) : null}
              {!isOwnProfile && activeProfile ? (
                <div className="flex gap-3">
                  <Button
                    className="rounded-full px-5"
                    variant={activeProfile.isFollowing ? "outline" : "default"}
                    disabled={followMutation.isPending && followMutation.variables === activeProfile.id}
                    onClick={() => followMutation.mutate(activeProfile.id)}
                  >
                    {activeProfile.isFollowing ? "Batal mengikuti" : "Ikuti"}
                  </Button>
                  <Button className="rounded-full px-5" variant="outline" onClick={() => openMessages(activeProfile.id)}>
                    Kirim pesan
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <Card className={surfaceClass}>
            <CardContent className="space-y-4 p-5">
              <p className="text-sm font-semibold text-white">{isOwnProfile ? "Post Anda" : "Post publik"}</p>
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
                displayedProfilePosts.map((post) => <ProfilePostRow key={post.id} post={post} />)
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (currentView === "more") {
      return (
        <div className="space-y-6">
          <SectionHeader title="Lainnya" description="Akses cepat ke pengaturan akun, keamanan, dan shortcut aplikasi." />
          <div className="grid gap-5 md:grid-cols-2">
            <Card className={surfaceClass}>
              <CardContent className="space-y-4 p-5">
                <p className="text-sm font-semibold text-white">Akun</p>
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
              </CardContent>
            </Card>

            <Card className={surfaceClass}>
              <CardContent className="space-y-4 p-5">
                <p className="text-sm font-semibold text-white">Keamanan</p>
                <InfoRow
                  title="Metode login"
                  value={currentUser?.email ? "Google atau akun RedPulse" : "Belum tersedia"}
                />
                <InfoRow
                  title="Email akun"
                  value={currentUser?.email ?? "Belum tersedia"}
                />
                <InfoRow
                  title="Status sesi"
                  value="Aktif di browser ini"
                />
              </CardContent>
            </Card>
          </div>

          <Card className={surfaceClass}>
            <CardContent className="space-y-4 p-5">
              <p className="text-sm font-semibold text-white">Shortcut</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ShortcutCard label="Jelajahi feed" onClick={() => setCurrentView("explore")} />
                <ShortcutCard label="Buka pesan" onClick={() => setCurrentView("messages")} />
                <ShortcutCard label="Lihat notifikasi" onClick={() => setCurrentView("notifications")} />
                <ShortcutCard label="Keluar dari akun" onClick={() => logoutMutation.mutate()} danger />
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4 md:space-y-6">
        <section className={cn("rounded-[22px] border p-4 shadow-[0_12px_36px_rgba(0,0,0,0.12)] lg:hidden", surfaceClass)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn("text-xs font-semibold uppercase tracking-[0.22em]", faintTextClass)}>Beranda</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-foreground">Halo, @{currentUser!.username}</h2>
              <p className={cn("mt-2 text-sm leading-6", subtleTextClass)}>
                Lihat update terbaru, bagikan momen, dan bangun percakapan dari satu layar yang ringkas.
              </p>
            </div>
            <Avatar username={currentUser!.username} avatarUrl={currentUser!.avatarUrl} size="md" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <StatCard label="Posts" value={profileSummary?.postsCount ?? 0} />
            <StatCard label="Followers" value={profileSummary?.followersCount ?? 0} />
            <StatCard label="Following" value={profileSummary?.followingCount ?? 0} />
          </div>

          <div className="mt-4 flex gap-2">
            <Button className="flex-1 rounded-full" size="sm" onClick={() => setCurrentView("create")}>
              Buat post
            </Button>
            <Button className="flex-1 rounded-full" size="sm" variant="outline" onClick={() => setCurrentView("search")}>
              Cari akun
            </Button>
          </div>
        </section>

        <section className="border-b border-border pb-4">
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <div>
              <p className="text-sm font-semibold text-foreground">Stories</p>
              <p className="text-xs text-foreground/45">Akun yang aktif hari ini</p>
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
                Stories akan mulai terisi saat akun lain ikut aktif. Untuk sekarang, Anda bisa memulai timeline dari post pertama.
              </div>
            )}
          </div>
        </section>
        {renderComposer()}
        <FeedList canLike={true} onCreateFirstPost={() => setCurrentView("create")} onOpenProfile={openProfile} />
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
          <CardTitle className="text-base text-white/88">Quick links</CardTitle>
          <button className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-white/70 transition hover:bg-white/[0.04]" onClick={() => setCurrentView("search")} type="button">
            Cari user lain
          </button>
          <button className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-white/70 transition hover:bg-white/[0.04]" onClick={() => openProfile()} type="button">
            Buka profil Anda
          </button>
        </div>
      );
    }

    if (currentView === "profile") {
      return (
        <div className="space-y-4">
          <CardTitle className="text-base text-white/88">Aksi cepat</CardTitle>
          <button className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-white/70 transition hover:bg-white/[0.04]" onClick={() => setCurrentView("create")} type="button">
            Tulis post baru
          </button>
          <button className="w-full rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm text-white/70 transition hover:bg-white/[0.04]" onClick={() => setCurrentView("home")} type="button">
            Kembali ke beranda
          </button>
        </div>
      );
    }

    if (currentView === "more") {
      return (
        <div className="space-y-4">
          <CardTitle className="text-base text-white/88">Ringkasan akun</CardTitle>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-white/62">
            Gunakan halaman ini untuk lompat cepat ke profil, composer, pencarian user, dan kontrol sesi akun Anda.
          </div>
          {profileSummary ? (
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Posts" value={profileSummary.postsCount} />
              <StatCard label="Followers" value={profileSummary.followersCount} />
              <StatCard label="Following" value={profileSummary.followingCount} />
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center gap-3">
          <Avatar username={currentUser.username} avatarUrl={currentUser.avatarUrl} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">@{currentUser.username}</p>
            <p className="truncate text-sm text-white/50">
              {profileSummary?.bio ?? "Masuk dengan Google dan mulai bangun jaringan Anda."}
            </p>
          </div>
          <button className="text-sm font-semibold text-primary" onClick={() => openProfile()} type="button">
            Akun
          </button>
        </div>

        {profileSummary ? (
          <div className="grid grid-cols-3 gap-3 border-b border-white/8 pb-6">
            <StatCard label="Posts" value={profileSummary.postsCount} />
            <StatCard label="Followers" value={profileSummary.followersCount} />
            <StatCard label="Following" value={profileSummary.followingCount} />
          </div>
        ) : null}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white/88">Disarankan untuk Anda</CardTitle>
            <button className="text-sm font-semibold text-white/70" onClick={() => setCurrentView("search")} type="button">
              Lihat semua
            </button>
          </div>
          <div className="space-y-4">
            {suggestedUsersQuery.isLoading ? (
              <div className="text-sm text-white/50">Mencari akun untuk Anda...</div>
            ) : suggestions.length === 0 ? (
              <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.02] p-4">
                <p className="text-sm font-semibold text-white">Jaringan Anda masih baru</p>
                <p className="text-sm leading-6 text-white/52">
                  Saat akun lain mendaftar, rekomendasi follow akan muncul di sini. Untuk sekarang, isi feed Anda dulu dan
                  bangun profil yang enak dilihat.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentView("create")}>
                    Buat post
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openProfile()}>
                    Rapikan profil
                  </Button>
                </div>
              </div>
            ) : (
              suggestions.map((user) => (
                <SuggestedUserRow
                  key={user.id}
                  user={user}
                  disabled={followMutation.isPending && followMutation.variables === user.id}
                  onFollow={() => {
                    followMutation.mutate(user.id);
                  }}
                  onOpenProfile={openProfile}
                />
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 border-t border-white/8 pt-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-base text-white/88">Topik yang mulai ramai</CardTitle>
          </div>
          {trendingTopics.length > 0 ? (
            <div className="space-y-3">
              {trendingTopics.map((topic) => (
                <button
                  key={topic.label}
                  className="flex w-full items-center justify-between rounded-[22px] border border-white/8 bg-white/[0.02] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.04]"
                  onClick={() => {
                    setSearchQuery(topic.label);
                    setCurrentView("search");
                  }}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-primary">
                      <Hash className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{topic.label}</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/32">{topic.count} post</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-white/42">Lihat</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.02] p-4 text-sm leading-6 text-white/52">
              Begitu user mulai memakai hashtag seperti <span className="font-semibold text-white">#update</span> atau{" "}
              <span className="font-semibold text-white">#launch</span>, topik ramai akan muncul otomatis di sini.
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
              <h1 className="mt-5 text-2xl font-black tracking-tight text-foreground">Memulihkan sesi Anda</h1>
              <p className="mt-3 text-sm leading-7 text-foreground/58">
                RedPulse sedang memastikan akun Anda tetap masuk dengan aman. Halaman utama akan terbuka sebentar lagi.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <main className={cn("mx-auto grid min-h-screen w-full max-w-[1400px] lg:grid-cols-[1.1fr_0.9fr]", shellClass)}>
        <section className="hidden border-r border-border lg:flex">
          <div className="flex w-full flex-col justify-between px-12 py-14 xl:px-16">
            <div className="space-y-10">
              <div className="flex items-center justify-between gap-4">
                <Logo />
                <ThemeToggle themeMode={themeMode} onToggle={() => setThemeMode(isLightTheme ? "dark" : "light")} />
              </div>
              <div className="max-w-2xl space-y-6">
                <h1 className="text-5xl font-black leading-tight tracking-tight text-foreground xl:text-6xl">
                  Social media yang lebih bersih, lebih fokus, dan enak dipakai setiap hari.
                </h1>
                <p className="max-w-xl text-lg leading-8 text-foreground/65">
                  Masuk dengan Google, ikuti akun lain, bagikan update, dan nikmati feed yang terasa modern tanpa layout
                  yang terlalu ramai.
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
              <ThemeToggle themeMode={themeMode} onToggle={() => setThemeMode(isLightTheme ? "dark" : "light")} />
            </div>

            <Card className="p-0">
              <CardContent className="space-y-8 p-7 sm:p-8">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Welcome to RedPulse</p>
                  <h2 className="text-3xl font-black tracking-tight text-foreground">Masuk untuk lanjut</h2>
                  <p className="text-sm leading-7 text-foreground/62">
                    Halaman utama dikunci sampai user login. Anda bisa lanjut dengan Google atau pakai akun RedPulse biasa.
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
                        disabled={googleLoginMutation.isPending}
                        onCredential={(credential) => {
                          setAuthError(null);
                          googleLoginMutation.mutate(
                            { credential },
                            {
                              onError: handleGoogleError
                            }
                          );
                        }}
                      />
                    </div>
                    <p className="text-center text-xs leading-6 text-foreground/35">
                      Jika popup Google ditutup atau gagal, coba lagi sekali dari tombol yang sama.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                    Google login belum siap di frontend. Pastikan `GOOGLE_CLIENT_ID` terbaca oleh server.
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
                      authMode === "login" ? "bg-foreground text-background" : "text-foreground/65 hover:text-foreground"
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
                      authMode === "register" ? "bg-foreground text-background" : "text-foreground/65 hover:text-foreground"
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
                      loginMutation.mutate(loginForm, {
                        onError: handleAuthError
                      });
                    }}
                  >
                    <div className="space-y-3">
                      <AuthInput
                        autoComplete="username"
                        label="Email atau username"
                        onChange={(value) => setLoginForm((current) => ({ ...current, identifier: value }))}
                        placeholder="nama@contoh.com atau username"
                        value={loginForm.identifier}
                      />
                      <AuthInput
                        autoComplete="current-password"
                        label="Password"
                        onChange={(value) => setLoginForm((current) => ({ ...current, password: value }))}
                        placeholder="Masukkan password"
                        type="password"
                        value={loginForm.password}
                      />
                    </div>

                    <Button className="w-full" disabled={loginMutation.isPending} type="submit">
                      {loginMutation.isPending ? "Masuk..." : "Login ke akun"}
                    </Button>
                  </form>
                ) : (
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setAuthError(null);
                      registerMutation.mutate(registerForm, {
                        onError: handleAuthError
                      });
                    }}
                  >
                    <div className="space-y-3">
                      <AuthInput
                        autoComplete="username"
                        label="Username"
                        onChange={(value) => setRegisterForm((current) => ({ ...current, username: value }))}
                        placeholder="username"
                        value={registerForm.username}
                      />
                      <AuthInput
                        autoComplete="email"
                        label="Email"
                        onChange={(value) => setRegisterForm((current) => ({ ...current, email: value }))}
                        placeholder="nama@contoh.com"
                        type="email"
                        value={registerForm.email}
                      />
                      <AuthInput
                        autoComplete="new-password"
                        label="Password"
                        onChange={(value) => setRegisterForm((current) => ({ ...current, password: value }))}
                        placeholder="Minimal 8 karakter"
                        type="password"
                        value={registerForm.password}
                      />
                    </div>

                    <Button className="w-full" disabled={registerMutation.isPending} type="submit">
                      {registerMutation.isPending ? "Membuat akun..." : "Buat akun baru"}
                    </Button>
                  </form>
                )}

                {authError ? (
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {authError}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <p className="text-center text-xs leading-6 text-foreground/35">
              UI dibuat fokus ke konten utama dan flow login, bukan penuh panel dekoratif.
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
        shellClass
      )}
    >
      <aside className="hidden lg:block">
        <div className="sticky top-0 flex min-h-[calc(100vh-2rem)] flex-col justify-between py-3">
          <div className="space-y-8">
            <div className="flex items-center justify-between gap-3 px-2">
              <Logo />
              <ThemeToggle themeMode={themeMode} onToggle={() => setThemeMode(isLightTheme ? "dark" : "light")} />
            </div>

            <nav className="space-y-2">
              <SidebarItem icon={Home} label="Beranda" active={currentView === "home"} onClick={() => setCurrentView("home")} />
              <SidebarItem icon={Search} label="Cari" active={currentView === "search"} onClick={() => setCurrentView("search")} />
              <SidebarItem icon={Compass} label="Jelajahi" active={currentView === "explore"} onClick={() => setCurrentView("explore")} />
              <SidebarItem icon={Send} label="Pesan" active={currentView === "messages"} onClick={() => setCurrentView("messages")} />
              <SidebarItem icon={Bell} label="Notifikasi" active={currentView === "notifications"} onClick={() => setCurrentView("notifications")} />
              <SidebarItem icon={PlusSquare} label="Buat" active={currentView === "create"} onClick={() => setCurrentView("create")} />
              <SidebarItem icon={UserRound} label="Profil" active={currentView === "profile"} onClick={() => openProfile()} />
            </nav>
          </div>

          <div className="space-y-3">
            <div className={cn("flex items-center gap-3 rounded-[24px] border px-4 py-4", softSurfaceClass)}>
              <Avatar username={authenticatedUser.username} avatarUrl={authenticatedUser.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">@{authenticatedUser.username}</p>
                <p className="truncate text-sm text-foreground/50">{authenticatedUser.email}</p>
              </div>
            </div>

            <Button className="w-full justify-start rounded-2xl" variant="outline" onClick={() => logoutMutation.mutate()}>
              <LogOut className="mr-2 h-4 w-4" />
              {logoutMutation.isPending ? "Signing out..." : "Keluar"}
            </Button>

            <button
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                currentView === "more" ? "bg-foreground/6 text-foreground" : "text-foreground/65 hover:bg-foreground/4"
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
            <p className="leading-6">Tentang . Bantuan . API . Privasi . Ketentuan . Lokasi . Bahasa</p>
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/22">Copyright 2026 RedPulse</p>
          </section>
        </div>
      </aside>

      <nav className={cn("fixed inset-x-0 bottom-0 z-30 border-t px-2 py-2 backdrop-blur lg:hidden", navChromeClass)}>
        <div className="mx-auto flex max-w-xl items-center justify-between gap-1">
          <MobileNavItem icon={Home} label="Home" active={currentView === "home"} onClick={() => setCurrentView("home")} />
          <MobileNavItem icon={Search} label="Cari" active={currentView === "search"} onClick={() => setCurrentView("search")} />
          <MobileNavItem icon={PlusSquare} label="Buat" active={currentView === "create"} onClick={() => setCurrentView("create")} />
          <MobileNavItem icon={Send} label="Pesan" active={currentView === "messages"} onClick={() => setCurrentView("messages")} />
          <MobileNavItem icon={UserRound} label="Profil" active={currentView === "profile"} onClick={() => openProfile()} />
        </div>
      </nav>

      <div className="fixed right-4 top-4 z-30 flex items-center gap-2 lg:hidden">
        <button
          className={cn(
            "inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold shadow-[0_12px_28px_rgba(0,0,0,0.16)] backdrop-blur transition",
            navChromeClass
          )}
          onClick={() => setCurrentView("more")}
          type="button"
        >
          <Menu className="mr-2 h-4 w-4" />
          Lainnya
        </button>
        <ThemeToggle themeMode={themeMode} onToggle={() => setThemeMode(isLightTheme ? "dark" : "light")} />
        <button
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_12px_28px_rgba(0,0,0,0.16)] backdrop-blur transition",
            navChromeClass
          )}
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
          type="button"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </main>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  onClick
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        active ? "bg-foreground/6 text-foreground" : "text-foreground/72 hover:bg-foreground/4 hover:text-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-foreground/62"}`} />
      <span>{label}</span>
    </button>
  );
}

function MobileNavItem({
  icon: Icon,
  label,
  active,
  onClick
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
      <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-foreground/55"}`} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-3">
      <h2 className="text-[28px] font-black tracking-tight text-foreground md:text-[32px]">{title}</h2>
      <p className="max-w-2xl text-sm leading-7 text-foreground/55">{description}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
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

function ActionRow({
  title,
  description,
  onClick
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
      <p className="text-xs uppercase tracking-[0.18em] text-foreground/38">{title}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ShortcutCard({
  label,
  onClick,
  danger = false
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

function ProfilePostRow({ post }: { post: FeedPost }) {
  return (
    <div className="rounded-[24px] border border-border bg-card/70 p-4">
      {post.media.length > 0 ? (
        <div className="mb-3 overflow-hidden rounded-[18px] border border-border bg-background">
          {post.media[0]?.type === "video" ? (
            <video className="max-h-56 w-full object-cover" controls playsInline preload="metadata" src={post.media[0].url} />
          ) : (
            <img alt={post.content ?? "Post media"} className="max-h-56 w-full object-cover" src={post.media[0]?.url} />
          )}
        </div>
      ) : null}
      <p className="text-sm leading-7 text-foreground/80">{post.content ?? "Post media tanpa caption."}</p>
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
    </div>
  );
}

function Avatar({
  username,
  avatarUrl,
  size
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
    <div className={`flex ${classes} shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 font-bold text-primary`}>
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}

function StoryBubble({
  username,
  avatarUrl,
  subtitle
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
        <p className="truncate text-xs font-medium text-foreground">{username}</p>
        <p className="truncate text-[11px] text-foreground/38">{subtitle}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-border bg-card/60 p-3 text-center shadow-[0_12px_28px_rgba(0,0,0,0.12)]">
      <div className="text-xl font-black tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-foreground/36">{label}</div>
    </div>
  );
}

function SuggestedUserRow({
  user,
  disabled,
  onFollow,
  onOpenProfile
}: {
  user: Pick<NetworkUser, "id" | "username" | "avatarUrl" | "bio" | "followersCount" | "postsCount" | "isFollowing">;
  disabled: boolean;
  onFollow: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button className="shrink-0" onClick={() => onOpenProfile?.(user.id)} type="button">
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
        <p className="truncate text-[12px] text-foreground/42">{user.bio ?? `${user.followersCount} followers . ${user.postsCount} posts`}</p>
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
  autoComplete
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
  return <div className="h-3.5 w-3.5 rounded-full bg-primary shadow-[0_0_20px_rgba(255,0,0,0.5)]" />;
}

function ThemeToggle({
  themeMode,
  onToggle
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
      {themeMode === "dark" ? <SunMedium className="h-4 w-4 text-primary" /> : <MoonStar className="h-4 w-4 text-primary" />}
    </button>
  );
}

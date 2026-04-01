import { useEffect, useMemo, useState } from "react";
import type { CreatePostInput, FeedPost, LoginInput, PublicProfile, RegisterInput, SuggestedUser } from "@redpulse/validation";
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
  PlusSquare,
  Search,
  Send,
  SmilePlus,
  TrendingUp,
  UserRound
} from "lucide-react";
import { Button, Card, CardContent, CardTitle, Logo, cn } from "@redpulse/ui";
import { ApiError } from "./lib/api";
import { GoogleSignInButton } from "./features/auth/google-sign-in-button";
import { FeedList } from "./features/feed/feed-list";
import {
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
  useSuggestedUsersQuery,
  useToggleFollowMutation
} from "./features/feed/hooks";

type AppView = "home" | "search" | "explore" | "messages" | "notifications" | "create" | "profile" | "more";

type NetworkUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  followersCount: number;
  postsCount: number;
  isFollowing: boolean;
};

const initialPostState: CreatePostInput = { content: "", location: "" };
const initialLoginState: LoginInput = { identifier: "", password: "" };
const initialRegisterState: RegisterInput = { username: "", email: "", password: "" };
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
    case "google-missing-code": return "Google tidak mengirim kode login. Coba masuk lagi.";
    case "google-email-not-verified": return "Email Google Anda belum terverifikasi.";
    case "google-redirect-mismatch": return "Redirect URI Google tidak cocok.";
    case "google-invalid-client": return "Client ID atau Secret Google tidak cocok.";
    case "google-invalid-grant": return "Kode login Google ditolak.";
    case "google-missing-id-token": return "Google tidak mengirim ID token.";
    case "google-login-failed": return "Login Google gagal. Coba lagi.";
    case "google-not-configured": return "Google login belum dikonfigurasi.";
    default: return "Login Google belum berhasil. Coba lagi.";
  }
}

function buildNetworkUsers(currentUserId: string, suggestions: SuggestedUser[], posts: FeedPost[]) {
  const map = new Map<string, NetworkUser>();
  for (const user of suggestions) {
    if (user.id === currentUserId) continue;
    map.set(user.id, { id: user.id, username: user.username, avatarUrl: user.avatarUrl, bio: user.bio, followersCount: user.followersCount, postsCount: user.postsCount, isFollowing: user.isFollowing });
  }
  for (const post of posts) {
    if (post.author.id === currentUserId || map.has(post.author.id)) continue;
    map.set(post.author.id, { id: post.author.id, username: post.author.username, avatarUrl: post.author.avatarUrl, bio: null, followersCount: 0, postsCount: posts.filter((item) => item.author.id === post.author.id).length, isFollowing: false });
  }
  return Array.from(map.values());
}

/* ────────── tiny Win2K helpers ────────── */
const WIN_FONT: React.CSSProperties = { fontFamily: "Tahoma, 'MS Sans Serif', Arial, sans-serif", fontSize: 11 };

/** A classic "window" with a blue title bar + silver body */
function WinPanel({
  title,
  icon,
  children,
  className,
  noPad = false
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
}) {
  return (
    <div className={cn("win-window overflow-hidden", className)}>
      {title !== undefined && (
        <div className="win-titlebar select-none">
          {icon && <span className="mr-1">{icon}</span>}
          <span style={WIN_FONT}>{title}</span>
          {/* fake title-bar buttons */}
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
      )}
      <div className={noPad ? "" : "p-2"}>{children}</div>
    </div>
  );
}

/** Classic toolbar bar */
function WinToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 border-b border-[#808080] bg-[#d4d0c8] px-1 py-1">
      {children}
    </div>
  );
}

/** Status bar at the bottom */
function WinStatusBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="win-statusbar flex items-center gap-2">
      {children}
    </div>
  );
}

/** Sunken input field */
function WinInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  list
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  list?: string;
}) {
  return (
    <label className="flex flex-col gap-[3px]">
      {label && <span className="text-[11px] text-black" style={WIN_FONT}>{label}</span>}
      <input
        autoComplete={autoComplete}
        className="win-sunken w-full px-1.5 py-0.5 text-[11px] text-black outline-none focus:outline-1 focus:outline-dotted focus:outline-black"
        list={list}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={WIN_FONT}
        type={type}
        value={value}
      />
    </label>
  );
}

/** Avatar – square like Win2K user photos */
function Avatar({ username, avatarUrl, size }: { username: string; avatarUrl?: string | null; size: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? 40 : size === "md" ? 28 : 20;
  const style: React.CSSProperties = { width: px, height: px, flexShrink: 0, ...WIN_FONT };
  if (avatarUrl) {
    return (
      <img
        alt={username}
        className="win-raised object-cover"
        src={avatarUrl}
        style={style}
      />
    );
  }
  return (
    <div
      className="win-raised flex items-center justify-center bg-[#d4d0c8] text-[10px] font-bold text-[#0a246a]"
      style={style}
    >
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}

/** Small stat box */
function StatCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="win-sunken flex flex-col items-center px-2 py-1">
      <span className="text-[14px] font-bold text-black" style={WIN_FONT}>{value}</span>
      <span className="text-[9px] text-[#808080]" style={WIN_FONT}>{label}</span>
    </div>
  );
}

/** Navigation tree item (left panel) */
function NavItem({
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
      className={cn(
        "flex w-full items-center gap-[6px] px-2 py-[2px] text-left text-[11px]",
        active ? "bg-[#0a246a] text-white" : "text-black hover:bg-[#d4d0c8]"
      )}
      style={WIN_FONT}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}

/** Mobile bottom bar item */
function MobileNavItem({ icon: Icon, label, active, onClick }: { icon: typeof Home; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center gap-[2px] px-1 py-[3px] text-[9px]",
        active ? "bg-[#0a246a] text-white" : "text-black"
      )}
      style={WIN_FONT}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-2">
      <h2 className="text-[13px] font-bold text-black" style={WIN_FONT}>{title}</h2>
      <p className="text-[11px] text-[#808080]" style={WIN_FONT}>{description}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="win-sunken p-3 text-center">
      <p className="text-[11px] font-bold text-black" style={WIN_FONT}>{title}</p>
      <p className="mt-1 text-[11px] text-[#808080]" style={WIN_FONT}>{description}</p>
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
    <div className="flex items-center gap-2 border-b border-[#d4d0c8] py-1">
      <button className="shrink-0" onClick={() => onOpenProfile?.(user.id)} type="button">
        <Avatar username={user.username} avatarUrl={user.avatarUrl} size="md" />
      </button>
      <div className="min-w-0 flex-1">
        <button
          className="block truncate text-[11px] font-bold text-[#0000cc] hover:underline"
          onClick={() => onOpenProfile?.(user.id)}
          style={WIN_FONT}
          type="button"
        >
          @{user.username}
        </button>
        <p className="truncate text-[10px] text-[#808080]" style={WIN_FONT}>
          {user.bio ?? `${user.followersCount} followers · ${user.postsCount} posts`}
        </p>
      </div>
      <Button
        size="sm"
        disabled={disabled}
        onClick={onFollow}
        type="button"
        className="shrink-0 text-[10px]"
      >
        {user.isFollowing ? "Unfollow" : "Follow"}
      </Button>
    </div>
  );
}

function ProfilePostRow({ post }: { post: FeedPost }) {
  return (
    <div className="win-sunken p-2">
      {post.media.length > 0 && (
        <div className="mb-2 win-sunken overflow-hidden">
          {post.media[0]?.type === "video" ? (
            <video className="max-h-40 w-full object-cover" controls playsInline preload="metadata" src={post.media[0].url} />
          ) : (
            <img alt={post.content ?? "Post media"} className="max-h-40 w-full object-cover" src={post.media[0]?.url} />
          )}
        </div>
      )}
      <p className="text-[11px] text-black" style={WIN_FONT}>{post.content ?? "Post media tanpa caption."}</p>
      {post.location && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-[#808080]" style={WIN_FONT}>
          <MapPin className="h-3 w-3" />
          {post.location}
        </p>
      )}
      <div className="mt-1 flex gap-3 text-[10px] text-[#808080]" style={WIN_FONT}>
        <span>{post.likeCount} pulse</span>
        <span>{post.type}</span>
      </div>
    </div>
  );
}

function ActionRow({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      className="win-raised w-full px-2 py-1.5 text-left hover:bg-[#e0ddd5] active:win-pressed"
      onClick={onClick}
      type="button"
    >
      <p className="text-[11px] font-bold text-black" style={WIN_FONT}>{title}</p>
      <p className="text-[10px] text-[#808080]" style={WIN_FONT}>{description}</p>
    </button>
  );
}

function InfoRow({ title, value }: { title: string; value: string }) {
  return (
    <div className="win-sunken px-2 py-1">
      <p className="text-[10px] text-[#808080]" style={WIN_FONT}>{title}</p>
      <p className="text-[11px] text-black" style={WIN_FONT}>{value}</p>
    </div>
  );
}

function ShortcutCard({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      className={cn(
        "win-raised px-3 py-2 text-left text-[11px] font-bold",
        danger ? "text-[#cc0000]" : "text-black"
      )}
      onClick={onClick}
      style={WIN_FONT}
      type="button"
    >
      {label}
    </button>
  );
}

/* ────────────────────────────────── Main App ────────────────────────────────── */
export default function App() {
  const [postForm, setPostForm] = useState<CreatePostInput>(initialPostState);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [showLocationField, setShowLocationField] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [currentView, setCurrentView] = useState<AppView>("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const [selectedMessageUserId, setSelectedMessageUserId] = useState<string | null>(null);
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
  const googleConfigQuery = useGoogleConfigQuery();
  const isOwnProfile = !selectedProfileUserId || selectedProfileUserId === currentUser?.id;
  const activeProfile: PublicProfile | null =
    isOwnProfile && currentUser && profileSummary
      ? { id: currentUser.id, username: currentUser.username, avatarUrl: currentUser.avatarUrl, bio: currentUser.bio, createdAt: currentUser.createdAt, postsCount: profileSummary.postsCount, followersCount: profileSummary.followersCount, followingCount: profileSummary.followingCount, isFollowing: false }
      : publicProfileQuery.data?.profile ?? null;

  const logoutMutation = useLogoutMutation(() => {
    setPostForm(initialPostState);
    setMediaFiles([]);
    setShowLocationField(false);
    setSelectedProfileUserId(null);
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
  const loginMutation = useLoginMutation(() => { setAuthError(null); setLoginForm(initialLoginState); });
  const registerMutation = useRegisterMutation(() => { setAuthError(null); setRegisterForm(initialRegisterState); });
  const googleLoginMutation = useGoogleLoginMutation(() => { setAuthError(null); });
  const followMutation = useToggleFollowMutation();

  const isAuthenticated = Boolean(currentUser);
  const authLoading = currentUserQuery.isLoading || googleConfigQuery.isLoading;
  const restoringSession = currentUserQuery.isLoading;
  const googleClientId = googleConfigQuery.data?.clientId ?? "";
  const allPosts = postsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const canSubmitPost = Boolean(postForm.content?.trim() || mediaFiles.length > 0);

  const mediaPreviews = useMemo(
    () => mediaFiles.map((file) => ({ name: file.name, type: file.type, url: URL.createObjectURL(file) })),
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
    return Array.from(topics.entries()).sort((l, r) => r[1] - l[1]).slice(0, 4).map(([label, count]) => ({ label, count }));
  }, [allPosts]);

  const networkUsers = useMemo(() => {
    if (!currentUser) return [];
    return buildNetworkUsers(currentUser.id, suggestions, allPosts);
  }, [allPosts, currentUser, suggestions]);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return networkUsers;
    return networkUsers.filter((u) => u.username.toLowerCase().includes(query) || (u.bio?.toLowerCase() ?? "").includes(query));
  }, [networkUsers, searchQuery]);

  const selectedMessageUser = useMemo(
    () => networkUsers.find((u) => u.id === selectedMessageUserId) ?? networkUsers[0] ?? null,
    [networkUsers, selectedMessageUserId]
  );

  const profilePosts = useMemo(() => allPosts.filter((p) => p.author.id === currentUser?.id), [allPosts, currentUser?.id]);
  const displayedProfilePosts = isOwnProfile ? profilePosts : publicProfileQuery.data?.posts ?? [];

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const authErrorParam = searchParams.get("authError");
    const authSuccessParam = searchParams.get("auth");
    if (authErrorParam) { setAuthError(getGoogleAuthErrorMessage(authErrorParam)); searchParams.delete("authError"); }
    if (authSuccessParam === "success") { setAuthError(null); searchParams.delete("auth"); }
    const nextQuery = searchParams.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`);
  }, []);

  useEffect(() => {
    if (!selectedMessageUserId && networkUsers[0]) setSelectedMessageUserId(networkUsers[0].id);
  }, [networkUsers, selectedMessageUserId]);

  useEffect(() => {
    return () => { for (const p of mediaPreviews) URL.revokeObjectURL(p.url); };
  }, [mediaPreviews]);

  function handlePostError(error: unknown) {
    setPostError(error instanceof ApiError ? error.message : "Post gagal dikirim. Coba lagi.");
  }
  function handleAuthError(error: unknown) {
    setAuthError(error instanceof ApiError ? error.message : "Autentikasi gagal.");
  }
  function handleGoogleError(error: unknown) {
    setAuthError(error instanceof ApiError ? error.message : "Login Google gagal.");
  }
  function appendToComposer(token: string) {
    setPostForm((c) => ({ ...c, content: `${c.content ?? ""}${token}`.slice(0, 280) }));
  }
  function openProfile(userId?: string | null) {
    if (!userId || userId === currentUser?.id) { setSelectedProfileUserId(null); setCurrentView("profile"); return; }
    setSelectedProfileUserId(userId);
    setCurrentView("profile");
  }

  /* ── Composer ──────────────────────────────────────────────────── */
  function renderComposer() {
    return (
      <WinPanel title="New Post - Composer" icon={<PlusSquare className="h-3 w-3 text-white" />}>
        <form
          className="space-y-2 p-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPostError(null);
            createPostMutation.mutate({ content: postForm.content, location: postForm.location, files: mediaFiles }, { onError: handlePostError });
          }}
        >
          <div className="flex items-start gap-2">
            <Avatar username={currentUser!.username} avatarUrl={currentUser!.avatarUrl} size="md" />
            <textarea
              className="win-sunken w-full resize-none p-1.5 text-[11px] text-black"
              maxLength={280}
              onChange={(e) => setPostForm((c) => ({ ...c, content: e.target.value }))}
              placeholder="Apa yang sedang Anda pikirkan?"
              rows={4}
              style={WIN_FONT}
              value={postForm.content ?? ""}
            />
          </div>

          {/* toolbar */}
          <WinToolbar>
            <label className="win-toolbar-btn flex cursor-pointer items-center gap-1 text-[11px] text-black" style={WIN_FONT}>
              <ImagePlus className="h-3.5 w-3.5" />
              Photo/Video
              <input accept="image/*,video/*" className="hidden" multiple onChange={(e) => setMediaFiles(Array.from(e.target.files ?? []).slice(0, 4))} type="file" />
            </label>
            <div className="mx-1 h-4 w-[1px] bg-[#808080]" />
            <button className="win-toolbar-btn flex items-center gap-1 text-[11px] text-black" onClick={() => appendToComposer("Mood: ")} style={WIN_FONT} type="button">
              <SmilePlus className="h-3.5 w-3.5" />
              Mood
            </button>
            <button className="win-toolbar-btn flex items-center gap-1 text-[11px] text-black" onClick={() => setShowLocationField((v) => !v)} style={WIN_FONT} type="button">
              <MapPin className="h-3.5 w-3.5" />
              {postForm.location?.trim() ? postForm.location : "Location"}
            </button>
            {mediaFiles.length > 0 && (
              <button className="win-toolbar-btn text-[11px] text-[#cc0000]" onClick={() => setMediaFiles([])} style={WIN_FONT} type="button">
                Clear media ({mediaFiles.length})
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-[#808080]" style={WIN_FONT}>{postForm.content?.length ?? 0}/280</span>
              <Button type="submit" disabled={createPostMutation.isPending || !canSubmitPost} size="sm">
                {createPostMutation.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </WinToolbar>

          {showLocationField && (
            <div className="space-y-1">
              <WinInput
                label="Location:"
                list="composer-location-options"
                onChange={(v) => setPostForm((c) => ({ ...c, location: v }))}
                placeholder="e.g. Makassar, Indonesia"
                value={postForm.location ?? ""}
              />
              <datalist id="composer-location-options">
                {featuredLocations.map((l) => <option key={l} value={l} />)}
              </datalist>
              <div className="flex flex-wrap gap-1">
                {featuredLocations.map((l) => (
                  <button
                    key={l}
                    className={cn("win-raised px-2 py-0.5 text-[10px]", postForm.location === l ? "bg-[#0a246a] text-white" : "text-black")}
                    onClick={() => setPostForm((c) => ({ ...c, location: l }))}
                    style={WIN_FONT}
                    type="button"
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mediaPreviews.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {mediaPreviews.map((preview, idx) => (
                <div key={`${preview.name}-${idx}`} className="win-sunken overflow-hidden">
                  <div className="aspect-[4/3] bg-white">
                    {preview.type.startsWith("video/") ? (
                      <video className="h-full w-full object-cover" controls muted playsInline src={preview.url} />
                    ) : (
                      <img alt={preview.name} className="h-full w-full object-cover" src={preview.url} />
                    )}
                  </div>
                  <div className="flex items-center justify-between px-2 py-0.5">
                    <p className="truncate text-[10px] text-[#808080]" style={WIN_FONT}>{preview.name}</p>
                    <button
                      className="text-[10px] text-[#cc0000]"
                      onClick={() => setMediaFiles((c) => c.filter((_, i) => i !== idx))}
                      style={WIN_FONT}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {postError && (
            <div className="win-sunken border-l-[3px] border-l-[#cc0000] px-2 py-1 text-[11px] text-[#cc0000]" style={WIN_FONT}>
              Error: {postError}
            </div>
          )}
        </form>
      </WinPanel>
    );
  }

  /* ── Main content router ───────────────────────────────────────── */
  function renderMainContent() {
    if (currentView === "search") {
      return (
        <WinPanel title="Search - RedPulse" icon={<Search className="h-3 w-3 text-white" />}>
          <div className="space-y-2 p-1">
            <SectionHeader title="Search Accounts" description="Find accounts by username or bio." />
            <WinInput onChange={setSearchQuery} placeholder="Enter username or bio..." value={searchQuery} />
            <div className="space-y-1">
              {filteredUsers.length === 0
                ? <EmptyState title="No Results" description="No accounts match your search." />
                : filteredUsers.map((u) => (
                  <SuggestedUserRow key={u.id} user={u} disabled={followMutation.isPending && followMutation.variables === u.id} onFollow={() => followMutation.mutate(u.id)} onOpenProfile={openProfile} />
                ))}
            </div>
          </div>
        </WinPanel>
      );
    }

    if (currentView === "explore") {
      return (
        <WinPanel title="Explore - RedPulse" icon={<Compass className="h-3 w-3 text-white" />}>
          <div className="p-1">
            <SectionHeader title="Explore" description="Browse the latest public posts on RedPulse." />
            <FeedList canLike={true} onCreateFirstPost={() => setCurrentView("create")} onOpenProfile={openProfile} />
          </div>
        </WinPanel>
      );
    }

    if (currentView === "messages") {
      return (
        <WinPanel title="Messages - RedPulse" icon={<Send className="h-3 w-3 text-white" />} noPad>
          <div className="grid lg:grid-cols-[200px_1fr]">
            {/* contact list */}
            <div className="win-sunken m-1 overflow-auto" style={{ maxHeight: 400 }}>
              {networkUsers.length === 0
                ? <EmptyState title="No conversations" description="Accounts will appear here." />
                : networkUsers.map((u) => (
                  <button
                    key={u.id}
                    className={cn(
                      "flex w-full items-center gap-2 px-2 py-1.5 text-left",
                      selectedMessageUser?.id === u.id ? "bg-[#0a246a] text-white" : "text-black hover:bg-[#d4d0c8]"
                    )}
                    onClick={() => setSelectedMessageUserId(u.id)}
                    style={WIN_FONT}
                    type="button"
                  >
                    <Avatar username={u.username} avatarUrl={u.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold">@{u.username}</p>
                      <p className="truncate text-[10px] opacity-70">{u.bio ?? "RedPulse account"}</p>
                    </div>
                  </button>
                ))
              }
            </div>
            {/* chat area */}
            <div className="p-2">
              {selectedMessageUser ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-[#808080] pb-2">
                    <Avatar username={selectedMessageUser.username} avatarUrl={selectedMessageUser.avatarUrl} size="md" />
                    <div>
                      <p className="text-[11px] font-bold text-black" style={WIN_FONT}>@{selectedMessageUser.username}</p>
                      <p className="text-[10px] text-[#808080]" style={WIN_FONT}>{selectedMessageUser.bio ?? "Ready to connect."}</p>
                    </div>
                  </div>
                  <div className="win-sunken p-2 text-[11px] text-[#808080]" style={WIN_FONT}>
                    Real-time chat coming soon. Navigation and contact list are ready.
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setCurrentView("search")}>Find users</Button>
                    <Button size="sm" variant="outline" onClick={() => openProfile(selectedMessageUser.id)}>View profile</Button>
                  </div>
                </div>
              ) : (
                <EmptyState title="No user selected" description="Select a contact from the list." />
              )}
            </div>
          </div>
        </WinPanel>
      );
    }

    if (currentView === "notifications") {
      const notices = [
        profileSummary ? `Your account has ${profileSummary.followersCount} followers and ${profileSummary.followingCount} following.` : null,
        suggestions.length > 0 ? `${suggestions.length} suggested accounts are available.` : null,
        allPosts.length > 0 ? `Feed has ${allPosts.length} recent posts.` : null
      ].filter(Boolean) as string[];
      return (
        <WinPanel title="Notifications - RedPulse" icon={<Bell className="h-3 w-3 text-white" />}>
          <div className="space-y-2 p-1">
            <SectionHeader title="Notifications" description="Account activity and important updates." />
            {notices.length === 0
              ? <EmptyState title="No notifications" description="Activity will appear here as your network grows." />
              : notices.map((n) => (
                <div key={n} className="win-sunken px-2 py-1.5 text-[11px] text-black" style={WIN_FONT}>{n}</div>
              ))
            }
          </div>
        </WinPanel>
      );
    }

    if (currentView === "create") {
      return (
        <div className="space-y-2">
          <SectionHeader title="Create Post" description="Write an update and publish it to your feed." />
          {renderComposer()}
          <WinPanel title="Quick Tips">
            <p className="p-1 text-[11px] text-[#808080]" style={WIN_FONT}>
              Keep it short and focused. After posting you will be returned to the home feed.
            </p>
          </WinPanel>
        </div>
      );
    }

    if (currentView === "profile") {
      const profileTitle = isOwnProfile ? "My Profile" : `@${activeProfile?.username ?? "profile"}`;
      return (
        <div className="space-y-2">
          <SectionHeader title={profileTitle} description={isOwnProfile ? "Account summary and your published posts." : "Public profile."} />
          {!isOwnProfile && publicProfileQuery.isLoading && (
            <div className="win-sunken flex items-center gap-2 p-2 text-[11px] text-[#808080]" style={WIN_FONT}>
              <Loader className="h-3 w-3 animate-spin" /> Loading profile...
            </div>
          )}
          <WinPanel title={`Profile - ${activeProfile?.username ?? (isOwnProfile ? currentUser!.username : "")}`} icon={<UserRound className="h-3 w-3 text-white" />}>
            <div className="space-y-3 p-1">
              <div className="flex items-center gap-3">
                <Avatar username={activeProfile?.username ?? (isOwnProfile ? currentUser!.username : "RP")} avatarUrl={activeProfile?.avatarUrl ?? (isOwnProfile ? currentUser!.avatarUrl : null)} size="lg" />
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-black" style={WIN_FONT}>@{activeProfile?.username ?? (isOwnProfile ? currentUser!.username : "profile")}</p>
                  <p className="text-[11px] text-[#808080]" style={WIN_FONT}>{isOwnProfile ? currentUser!.email : "Public RedPulse account"}</p>
                  <p className="mt-1 text-[11px] text-black" style={WIN_FONT}>{activeProfile?.bio ?? "No bio."}</p>
                </div>
              </div>
              {activeProfile && (
                <div className="grid grid-cols-3 gap-2">
                  <StatCell label="Posts" value={activeProfile.postsCount} />
                  <StatCell label="Followers" value={activeProfile.followersCount} />
                  <StatCell label="Following" value={activeProfile.followingCount} />
                </div>
              )}
              {!isOwnProfile && activeProfile && (
                <div className="flex gap-2">
                  <Button size="sm" variant={activeProfile.isFollowing ? "outline" : "default"} disabled={followMutation.isPending && followMutation.variables === activeProfile.id} onClick={() => followMutation.mutate(activeProfile.id)}>
                    {activeProfile.isFollowing ? "Unfollow" : "Follow"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCurrentView("messages")}>Message</Button>
                </div>
              )}
            </div>
          </WinPanel>
          <WinPanel title="Posts">
            <div className="space-y-2 p-1">
              {displayedProfilePosts.length === 0
                ? <EmptyState title="No posts" description={isOwnProfile ? "Your posts will appear here." : "This user has no public posts."} />
                : displayedProfilePosts.map((p) => <ProfilePostRow key={p.id} post={p} />)
              }
            </div>
          </WinPanel>
        </div>
      );
    }

    if (currentView === "more") {
      return (
        <div className="space-y-2">
          <SectionHeader title="More" description="Quick access to account settings, security, and shortcuts." />
          <div className="grid gap-2 md:grid-cols-2">
            <WinPanel title="Account">
              <div className="space-y-1 p-1">
                <ActionRow title="View profile" description="Open your profile and activity summary." onClick={() => openProfile()} />
                <ActionRow title="New post" description="Go to the post composer." onClick={() => setCurrentView("create")} />
                <ActionRow title="Search users" description="Find other users in the RedPulse network." onClick={() => setCurrentView("search")} />
              </div>
            </WinPanel>
            <WinPanel title="Security">
              <div className="space-y-1 p-1">
                <InfoRow title="Login method" value={currentUser?.email ? "Google or RedPulse account" : "N/A"} />
                <InfoRow title="Email" value={currentUser?.email ?? "N/A"} />
                <InfoRow title="Session status" value="Active in this browser" />
              </div>
            </WinPanel>
          </div>
          <WinPanel title="Shortcuts">
            <div className="grid gap-2 p-1 sm:grid-cols-2">
              <ShortcutCard label="Explore feed" onClick={() => setCurrentView("explore")} />
              <ShortcutCard label="Open messages" onClick={() => setCurrentView("messages")} />
              <ShortcutCard label="Notifications" onClick={() => setCurrentView("notifications")} />
              <ShortcutCard label="Sign out" onClick={() => logoutMutation.mutate()} danger />
            </div>
          </WinPanel>
        </div>
      );
    }

    /* home */
    return (
      <div className="space-y-2">
        {/* mobile user header */}
        <WinPanel title="Home - RedPulse" icon={<Home className="h-3 w-3 text-white" />} className="lg:hidden">
          <div className="flex items-center gap-3 p-1">
            <Avatar username={currentUser!.username} avatarUrl={currentUser!.avatarUrl} size="md" />
            <div className="min-w-0">
              <h2 className="text-[12px] font-bold text-black" style={WIN_FONT}>@{currentUser!.username}</h2>
              <p className="text-[10px] text-[#808080]" style={WIN_FONT}>Welcome back</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1 p-1">
            <StatCell label="Posts" value={profileSummary?.postsCount ?? 0} />
            <StatCell label="Followers" value={profileSummary?.followersCount ?? 0} />
            <StatCell label="Following" value={profileSummary?.followingCount ?? 0} />
          </div>
          <div className="flex gap-2 p-1">
            <Button className="flex-1" size="sm" onClick={() => setCurrentView("create")}>New Post</Button>
            <Button className="flex-1" size="sm" variant="outline" onClick={() => setCurrentView("search")}>Find Users</Button>
          </div>
        </WinPanel>

        {renderComposer()}
        <WinPanel title="Feed" icon={<TrendingUp className="h-3 w-3 text-white" />}>
          <div className="p-1">
            <FeedList canLike={true} onCreateFirstPost={() => setCurrentView("create")} onOpenProfile={openProfile} />
          </div>
        </WinPanel>
      </div>
    );
  }

  /* ── Right aside ───────────────────────────────────────────────── */
  function renderRightAside() {
    if (!currentUser) return null;

    if (currentView === "messages") {
      return (
        <WinPanel title="Quick Links">
          <div className="space-y-1 p-1">
            <button className="win-raised w-full px-2 py-1 text-left text-[11px] text-black" onClick={() => setCurrentView("search")} style={WIN_FONT} type="button">Find more users</button>
            <button className="win-raised w-full px-2 py-1 text-left text-[11px] text-black" onClick={() => openProfile()} style={WIN_FONT} type="button">Open your profile</button>
          </div>
        </WinPanel>
      );
    }
    if (currentView === "profile") {
      return (
        <WinPanel title="Quick Actions">
          <div className="space-y-1 p-1">
            <button className="win-raised w-full px-2 py-1 text-left text-[11px] text-black" onClick={() => setCurrentView("create")} style={WIN_FONT} type="button">New post</button>
            <button className="win-raised w-full px-2 py-1 text-left text-[11px] text-black" onClick={() => setCurrentView("home")} style={WIN_FONT} type="button">Back to home</button>
          </div>
        </WinPanel>
      );
    }
    if (currentView === "more") {
      return (
        <WinPanel title="Account Summary">
          <div className="p-1">
            <p className="text-[11px] text-[#808080]" style={WIN_FONT}>Use this page to quickly jump to your profile, composer, search, and session controls.</p>
            {profileSummary && (
              <div className="mt-2 grid grid-cols-3 gap-1">
                <StatCell label="Posts" value={profileSummary.postsCount} />
                <StatCell label="Followers" value={profileSummary.followersCount} />
                <StatCell label="Following" value={profileSummary.followingCount} />
              </div>
            )}
          </div>
        </WinPanel>
      );
    }

    return (
      <div className="space-y-2">
        {/* current user */}
        <WinPanel title="My Account">
          <div className="space-y-2 p-1">
            <div className="flex items-center gap-2">
              <Avatar username={currentUser.username} avatarUrl={currentUser.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold text-black" style={WIN_FONT}>@{currentUser.username}</p>
                <p className="truncate text-[10px] text-[#808080]" style={WIN_FONT}>{currentUser.email}</p>
              </div>
              <button className="text-[11px] text-[#0000cc] hover:underline" onClick={() => openProfile()} style={WIN_FONT} type="button">Profile</button>
            </div>
            {profileSummary && (
              <div className="grid grid-cols-3 gap-1">
                <StatCell label="Posts" value={profileSummary.postsCount} />
                <StatCell label="Followers" value={profileSummary.followersCount} />
                <StatCell label="Following" value={profileSummary.followingCount} />
              </div>
            )}
          </div>
        </WinPanel>

        {/* suggested */}
        <WinPanel title="Suggested For You">
          <div className="p-1">
            {suggestedUsersQuery.isLoading ? (
              <p className="text-[11px] text-[#808080]" style={WIN_FONT}>Searching...</p>
            ) : suggestions.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] text-[#808080]" style={WIN_FONT}>No suggestions yet. As others join, recommendations will appear here.</p>
                <Button size="sm" onClick={() => setCurrentView("create")}>Create post</Button>
              </div>
            ) : (
              suggestions.map((u) => (
                <SuggestedUserRow key={u.id} user={u} disabled={followMutation.isPending && followMutation.variables === u.id} onFollow={() => followMutation.mutate(u.id)} onOpenProfile={openProfile} />
              ))
            )}
          </div>
        </WinPanel>

        {/* trending */}
        <WinPanel title="Trending Topics" icon={<TrendingUp className="h-3 w-3 text-white" />}>
          <div className="p-1">
            {trendingTopics.length > 0 ? (
              trendingTopics.map((topic) => (
                <button
                  key={topic.label}
                  className="flex w-full items-center justify-between border-b border-[#d4d0c8] px-1 py-1.5 text-left hover:bg-[#d4d0c8]"
                  onClick={() => { setSearchQuery(topic.label); setCurrentView("search"); }}
                  style={WIN_FONT}
                  type="button"
                >
                  <span className="flex items-center gap-1 text-[11px] text-[#0000cc]">
                    <Hash className="h-3 w-3" />
                    {topic.label}
                  </span>
                  <span className="text-[10px] text-[#808080]">{topic.count} posts</span>
                </button>
              ))
            ) : (
              <p className="text-[11px] text-[#808080]" style={WIN_FONT}>
                When users start using hashtags like <span className="font-bold">#update</span>, topics will appear here.
              </p>
            )}
          </div>
        </WinPanel>
      </div>
    );
  }

  /* ── Loading screen ────────────────────────────────────────────── */
  if (restoringSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#008080]">
        <WinPanel title="RedPulse - Loading" icon={<Logo compact />} className="w-full max-w-sm">
          <div className="flex flex-col items-center gap-3 p-4">
            <div className="flex items-center gap-2">
              <Loader className="h-4 w-4 animate-spin text-[#0a246a]" />
              <span className="text-[11px] text-black" style={WIN_FONT}>Restoring your session. Please wait...</span>
            </div>
            {/* Windows XP-style progress bar */}
            <div className="win-sunken h-4 w-full overflow-hidden">
              <div className="h-full w-2/3 animate-pulse bg-[#0a246a]" />
            </div>
          </div>
          <WinStatusBar>
            <span className="win-statusbar-panel" style={WIN_FONT}>Connecting...</span>
          </WinStatusBar>
        </WinPanel>
      </main>
    );
  }

  /* ── Auth screen ───────────────────────────────────────────────── */
  if (!isAuthenticated || !currentUser) {
    return (
      <main className="flex min-h-screen items-start bg-[#008080] p-4 lg:items-center">
        <div className="mx-auto grid w-full max-w-[1100px] gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left panel – feature list */}
          <WinPanel title="RedPulse - Social Feed Application" icon={<Logo compact />} className="hidden lg:block">
            <div className="space-y-4 p-3">
              <div className="space-y-2">
                <h1 className="text-[15px] font-bold text-black" style={WIN_FONT}>
                  Social media yang lebih bersih, lebih fokus, dan enak dipakai setiap hari.
                </h1>
                <p className="text-[11px] leading-5 text-[#808080]" style={WIN_FONT}>
                  Sign in with Google, follow other users, share updates, and enjoy a clean modern feed.
                </p>
              </div>

              {/* feature list */}
              <WinPanel title="Features">
                <div className="space-y-1 p-1">
                  {[
                    { label: "Google Login", desc: "Sign in quickly with your Google account" },
                    { label: "Real Feed", desc: "See posts from accounts you follow" },
                    { label: "Minimal UI", desc: "Clean, focused layout for daily use" }
                  ].map((f) => (
                    <div key={f.label} className="flex items-start gap-2 border-b border-[#d4d0c8] pb-1">
                      <div className="mt-0.5 h-3 w-3 shrink-0 win-raised" />
                      <div>
                        <p className="text-[11px] font-bold text-black" style={WIN_FONT}>{f.label}</p>
                        <p className="text-[10px] text-[#808080]" style={WIN_FONT}>{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </WinPanel>
            </div>
            <WinStatusBar>
              <span className="win-statusbar-panel" style={WIN_FONT}>Ready</span>
              <span className="win-statusbar-panel" style={WIN_FONT}>Google Login</span>
              <span className="win-statusbar-panel" style={WIN_FONT}>Minimal UI</span>
            </WinStatusBar>
          </WinPanel>

          {/* Right panel – login form */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 lg:hidden">
              <Logo />
            </div>

            <WinPanel title="Sign In - RedPulse" icon={<UserRound className="h-3 w-3 text-white" />}>
              <div className="space-y-4 p-3">
                <div>
                  <p className="text-[11px] font-bold text-[#0a246a] uppercase" style={WIN_FONT}>Welcome to RedPulse</p>
                  <h2 className="text-[13px] font-bold text-black" style={WIN_FONT}>Sign in to continue</h2>
                  <p className="text-[11px] text-[#808080]" style={WIN_FONT}>
                    The main page requires authentication. Use Google or a RedPulse account.
                  </p>
                </div>

                {authLoading ? (
                  <div className="win-sunken flex items-center gap-2 p-2">
                    <Loader className="h-4 w-4 animate-spin text-[#0a246a]" />
                    <span className="text-[11px]" style={WIN_FONT}>Loading...</span>
                  </div>
                ) : googleClientId ? (
                  <div className="space-y-1">
                    <div className="win-sunken flex justify-center p-2">
                      <GoogleSignInButton
                        clientId={googleClientId}
                        disabled={googleLoginMutation.isPending}
                        onCredential={(credential) => {
                          setAuthError(null);
                          googleLoginMutation.mutate({ credential }, { onError: handleGoogleError });
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[#808080]" style={WIN_FONT}>If the Google popup closes or fails, try again from the same button.</p>
                  </div>
                ) : (
                  <div className="win-sunken border-l-[3px] border-l-yellow-500 p-2 text-[11px]" style={WIN_FONT}>
                    Google login not configured. Ensure GOOGLE_CLIENT_ID is set on the server.
                  </div>
                )}

                {/* divider */}
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-[#808080]" />
                  <span className="text-[10px] text-[#808080]" style={WIN_FONT}>– OR –</span>
                  <div className="h-px flex-1 bg-[#808080]" />
                </div>

                {/* tab strip */}
                <div className="flex border-b border-[#808080]">
                  {(["login", "register"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={cn(
                        "px-4 py-1 text-[11px] border border-b-0 -mb-px",
                        authMode === mode
                          ? "bg-[#d4d0c8] border-[#808080] text-black font-bold"
                          : "bg-[#c0bdb5] border-transparent text-[#808080]"
                      )}
                      onClick={() => { setAuthMode(mode); setAuthError(null); }}
                      style={WIN_FONT}
                      type="button"
                    >
                      {mode === "login" ? "Login" : "Create Account"}
                    </button>
                  ))}
                </div>

                {authMode === "login" ? (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => { e.preventDefault(); setAuthError(null); loginMutation.mutate(loginForm, { onError: handleAuthError }); }}
                  >
                    <WinInput autoComplete="username" label="Email or username:" onChange={(v) => setLoginForm((c) => ({ ...c, identifier: v }))} placeholder="name@example.com or username" value={loginForm.identifier} />
                    <WinInput autoComplete="current-password" label="Password:" onChange={(v) => setLoginForm((c) => ({ ...c, password: v }))} placeholder="Enter your password" type="password" value={loginForm.password} />
                    <div className="flex justify-end gap-2">
                      <Button type="submit" disabled={loginMutation.isPending}>
                        {loginMutation.isPending ? "Signing in..." : "OK"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setAuthMode("register"); setAuthError(null); }}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => { e.preventDefault(); setAuthError(null); registerMutation.mutate(registerForm, { onError: handleAuthError }); }}
                  >
                    <WinInput autoComplete="username" label="Username:" onChange={(v) => setRegisterForm((c) => ({ ...c, username: v }))} placeholder="username" value={registerForm.username} />
                    <WinInput autoComplete="email" label="Email:" onChange={(v) => setRegisterForm((c) => ({ ...c, email: v }))} placeholder="name@example.com" type="email" value={registerForm.email} />
                    <WinInput autoComplete="new-password" label="Password:" onChange={(v) => setRegisterForm((c) => ({ ...c, password: v }))} placeholder="Minimum 8 characters" type="password" value={registerForm.password} />
                    <div className="flex justify-end gap-2">
                      <Button type="submit" disabled={registerMutation.isPending}>
                        {registerMutation.isPending ? "Creating..." : "OK"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => { setAuthMode("login"); setAuthError(null); }}>Cancel</Button>
                    </div>
                  </form>
                )}

                {authError && (
                  <div className="win-sunken border-l-[3px] border-l-[#cc0000] p-2 text-[11px] text-[#cc0000]" style={WIN_FONT}>
                    {authError}
                  </div>
                )}
              </div>
              <WinStatusBar>
                <span className="win-statusbar-panel" style={WIN_FONT}>Ready</span>
              </WinStatusBar>
            </WinPanel>

            <p className="text-center text-[10px] text-white" style={WIN_FONT}>
              UI focused on content and clean login flow.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* ── Authenticated shell ───────────────────────────────────────── */
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-[1480px] gap-2 bg-[#008080] p-2 pb-16 lg:grid-cols-[180px_minmax(0,1fr)] lg:pb-2 xl:grid-cols-[180px_minmax(0,680px)_280px]">

      {/* ── Left sidebar ── */}
      <aside className="hidden lg:block">
        <div className="sticky top-2 space-y-2">
          {/* App window */}
          <WinPanel title="RedPulse" icon={<Logo compact />}>
            <nav className="p-0.5">
              <NavItem icon={Home} label="Home" active={currentView === "home"} onClick={() => setCurrentView("home")} />
              <NavItem icon={Search} label="Search" active={currentView === "search"} onClick={() => setCurrentView("search")} />
              <NavItem icon={Compass} label="Explore" active={currentView === "explore"} onClick={() => setCurrentView("explore")} />
              <NavItem icon={Send} label="Messages" active={currentView === "messages"} onClick={() => setCurrentView("messages")} />
              <NavItem icon={Bell} label="Notifications" active={currentView === "notifications"} onClick={() => setCurrentView("notifications")} />
              <NavItem icon={PlusSquare} label="Create" active={currentView === "create"} onClick={() => setCurrentView("create")} />
              <NavItem icon={UserRound} label="Profile" active={currentView === "profile"} onClick={() => openProfile()} />
              <hr className="win-separator my-1" />
              <NavItem icon={Menu} label="More" active={currentView === "more"} onClick={() => setCurrentView("more")} />
            </nav>
          </WinPanel>

          {/* Logged-in user card */}
          <WinPanel title="Current User">
            <div className="space-y-2 p-1">
              <div className="flex items-center gap-2">
                <Avatar username={currentUser.username} avatarUrl={currentUser.avatarUrl} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-bold text-black" style={WIN_FONT}>@{currentUser.username}</p>
                  <p className="truncate text-[10px] text-[#808080]" style={WIN_FONT}>{currentUser.email}</p>
                </div>
              </div>
              <Button
                className="w-full justify-start"
                size="sm"
                variant="outline"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="mr-1 h-3 w-3" />
                {logoutMutation.isPending ? "Signing out..." : "Sign Out"}
              </Button>
            </div>
          </WinPanel>
        </div>
      </aside>

      {/* ── Main content ── */}
      <section className="space-y-2">
        {renderMainContent()}
      </section>

      {/* ── Right aside ── */}
      <aside className="hidden xl:block">
        <div className="sticky top-2 space-y-2">
          {renderRightAside()}
          <div className="win-statusbar text-[10px] text-[#404040]" style={WIN_FONT}>
            <span>About · Help · Privacy · Terms</span>
            <span className="ml-auto">© 2026 RedPulse</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav bar ── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-t-white bg-[#d4d0c8] lg:hidden" style={{ borderBottom: "2px solid #404040" }}>
        <div className="flex">
          <MobileNavItem icon={Home} label="Home" active={currentView === "home"} onClick={() => setCurrentView("home")} />
          <MobileNavItem icon={Search} label="Search" active={currentView === "search"} onClick={() => setCurrentView("search")} />
          <MobileNavItem icon={PlusSquare} label="Create" active={currentView === "create"} onClick={() => setCurrentView("create")} />
          <MobileNavItem icon={Send} label="Messages" active={currentView === "messages"} onClick={() => setCurrentView("messages")} />
          <MobileNavItem icon={UserRound} label="Profile" active={currentView === "profile"} onClick={() => openProfile()} />
        </div>
      </nav>
    </main>
  );
}

import { and, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { follows, getDb, posts, users } from "@redpulse/db";
import type { ProfileSummary, PublicProfile, SuggestedUser, ToggleFollowResponse } from "@redpulse/validation";
import { getPostsByAuthor } from "./post-service.js";

function mapProfileSummary(row: {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  postsCount: number;
  followersCount: number;
  followingCount: number;
}): ProfileSummary {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    createdAt: row.createdAt.toISOString(),
    postsCount: Number(row.postsCount),
    followersCount: Number(row.followersCount),
    followingCount: Number(row.followingCount)
  };
}

export async function getProfileSummary(userId: string): Promise<ProfileSummary | null> {
  const db = getDb();

  const [userRow] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    return null;
  }

  const [postsCountRow, followersCountRow, followingCountRow] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(posts)
      .where(and(eq(posts.authorId, userId), isNull(posts.parentId)))
      .limit(1),
    db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(follows)
      .where(eq(follows.followingId, userId))
      .limit(1),
    db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(follows)
      .where(eq(follows.followerId, userId))
      .limit(1)
  ]);

  return mapProfileSummary({
    ...userRow,
    postsCount: Number(postsCountRow[0]?.count ?? 0),
    followersCount: Number(followersCountRow[0]?.count ?? 0),
    followingCount: Number(followingCountRow[0]?.count ?? 0)
  });
}

function mapPublicProfile(row: {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
}): PublicProfile {
  return {
    id: row.id,
    username: row.username,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    createdAt: row.createdAt.toISOString(),
    postsCount: Number(row.postsCount),
    followersCount: Number(row.followersCount),
    followingCount: Number(row.followingCount),
    isFollowing: row.isFollowing
  };
}

export async function getPublicProfile(userId: string, viewerId?: string | null) {
  const db = getDb();

  const isFollowingSql = viewerId
    ? sql<boolean>`exists(
        select 1
        from ${follows} f_view
        where f_view.follower_id = ${viewerId}
          and f_view.following_id = ${users.id}
      )`
    : sql<boolean>`false`;

  const [userRow] = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      createdAt: users.createdAt,
      isFollowing: isFollowingSql
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    return null;
  }

  const [postsCountRow, followersCountRow, followingCountRow, authoredPosts] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(posts)
      .where(and(eq(posts.authorId, userId), isNull(posts.parentId)))
      .limit(1),
    db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(follows)
      .where(eq(follows.followingId, userId))
      .limit(1),
    db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(follows)
      .where(eq(follows.followerId, userId))
      .limit(1),
    getPostsByAuthor(userId, viewerId)
  ]);

  return {
    profile: mapPublicProfile({
      ...userRow,
      postsCount: Number(postsCountRow[0]?.count ?? 0),
      followersCount: Number(followersCountRow[0]?.count ?? 0),
      followingCount: Number(followingCountRow[0]?.count ?? 0)
    }),
    posts: authoredPosts
  };
}

export async function getSuggestedUsers(viewerId?: string | null): Promise<SuggestedUser[]> {
  const db = getDb();

  const isFollowingSql = viewerId
    ? sql<boolean>`exists(
        select 1
        from ${follows} f_view
        where f_view.follower_id = ${viewerId}
          and f_view.following_id = ${users.id}
      )`
    : sql<boolean>`false`;

  const whereClause = viewerId ? ne(users.id, viewerId) : sql`true`;

  const results = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      followersCount: sql<number>`(
        select count(*)::int
        from follows f
        where f.following_id = ${users.id}
      )`,
      postsCount: sql<number>`(
        select count(*)::int
        from posts p
        where p.author_id = ${users.id}
          and p.parent_id is null
      )`,
      isFollowing: isFollowingSql
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(5);

  return results
    .filter((row) => row.id !== viewerId)
    .map((row) => ({
      id: row.id,
      username: row.username,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
      followersCount: Number(row.followersCount),
      postsCount: Number(row.postsCount),
      isFollowing: row.isFollowing
    }));
}

export async function toggleFollow(targetUserId: string, viewerId: string): Promise<ToggleFollowResponse | null> {
  if (targetUserId === viewerId) {
    return {
      userId: targetUserId,
      isFollowing: false,
      followersCount: 0
    };
  }

  const db = getDb();

  return db.transaction(async (tx) => {
    const targetUser = await tx.query.users.findFirst({
      where: eq(users.id, targetUserId),
      columns: { id: true }
    });

    if (!targetUser) {
      return null;
    }

    const existing = await tx.query.follows.findFirst({
      where: and(eq(follows.followerId, viewerId), eq(follows.followingId, targetUserId))
    });

    if (existing) {
      await tx.delete(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followingId, targetUserId)));
    } else {
      await tx.insert(follows).values({
        followerId: viewerId,
        followingId: targetUserId
      });
    }

    const [counts] = await tx
      .select({
        followersCount: sql<number>`count(*)::int`
      })
      .from(follows)
      .where(eq(follows.followingId, targetUserId));

    return {
      userId: targetUserId,
      isFollowing: !existing,
      followersCount: Number(counts?.followersCount ?? 0)
    };
  });
}

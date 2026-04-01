import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, likes, media, posts, users } from "@redpulse/db";
import type {
  CreateCommentInput,
  CreatePostInput,
  FeedPost,
  FeedResponse,
  PostMedia,
  ToggleLikeResponse
} from "@redpulse/validation";
import { uploadPostMedia, type UploadMediaFile } from "../lib/media.js";

const defaultLimit = 10;

type CursorPayload = {
  id: string;
  createdAt: string;
};

function encodeCursor(value: CursorPayload) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(cursor?: string | null) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as CursorPayload;
    return {
      id: parsed.id,
      createdAt: new Date(parsed.createdAt)
    };
  } catch {
    return null;
  }
}

function mapFeedPost(row: {
  id: string;
  content: string | null;
  location: string | null;
  type: "post" | "reply" | "repost";
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  media: PostMedia[];
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
}): FeedPost {
  return {
    id: row.id,
    content: row.content,
    location: row.location,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    likeCount: Number(row.likeCount),
    commentCount: Number(row.commentCount),
    likedByMe: row.likedByMe,
    media: row.media,
    author: {
      id: row.authorId,
      username: row.authorUsername,
      avatarUrl: row.authorAvatarUrl
    }
  };
}

async function getMediaByPostIds(postIds: string[]) {
  if (postIds.length === 0) {
    return new Map<string, PostMedia[]>();
  }

  const db = getDb();
  const rows = await db
    .select({
      id: media.id,
      postId: media.postId,
      url: media.url,
      type: media.type,
      sortOrder: media.sortOrder
    })
    .from(media)
    .where(inArray(media.postId, postIds))
    .orderBy(asc(media.postId), asc(media.sortOrder));

  const map = new Map<string, PostMedia[]>();

  for (const row of rows) {
    const current = map.get(row.postId) ?? [];
    current.push({
      id: row.id,
      url: row.url,
      type: row.type,
      sortOrder: row.sortOrder
    });
    map.set(row.postId, current);
  }

  return map;
}

async function getPostById(postId: string, viewerId?: string | null): Promise<FeedPost | null> {
  const db = getDb();

  const likedByMeSql = viewerId
    ? sql<boolean>`coalesce(bool_or(${likes.userId} = ${viewerId}), false)`
    : sql<boolean>`false`;

  const [row] = await db
    .select({
      id: posts.id,
      content: posts.content,
      location: posts.location,
      type: posts.type,
      createdAt: posts.createdAt,
      likeCount: sql<number>`count(${likes.userId})::int`,
      commentCount: sql<number>`(select count(*)::int from posts as replies where replies.parent_id = ${posts.id})`,
      likedByMe: likedByMeSql,
      authorId: users.id,
      authorUsername: users.username,
      authorAvatarUrl: users.avatarUrl
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(eq(posts.id, postId))
    .groupBy(posts.id, users.id);

  if (!row) {
    return null;
  }

  const mediaMap = await getMediaByPostIds([row.id]);

  return mapFeedPost({
    ...row,
    media: mediaMap.get(row.id) ?? []
  });
}

async function getPostsByAuthorIds(authorIds: string[], viewerId?: string | null) {
  if (authorIds.length === 0) {
    return [] as FeedPost[];
  }

  const db = getDb();

  const likedByMeSql = viewerId
    ? sql<boolean>`coalesce(bool_or(${likes.userId} = ${viewerId}), false)`
    : sql<boolean>`false`;

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      location: posts.location,
      type: posts.type,
      createdAt: posts.createdAt,
      likeCount: sql<number>`count(${likes.userId})::int`,
      commentCount: sql<number>`(select count(*)::int from posts as replies where replies.parent_id = ${posts.id})`,
      likedByMe: likedByMeSql,
      authorId: users.id,
      authorUsername: users.username,
      authorAvatarUrl: users.avatarUrl
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(and(inArray(posts.authorId, authorIds), isNull(posts.parentId)))
    .groupBy(posts.id, users.id)
    .orderBy(desc(posts.createdAt), desc(posts.id));

  const mediaMap = await getMediaByPostIds(rows.map((row) => row.id));

  return rows.map((row) =>
    mapFeedPost({
      ...row,
      media: mediaMap.get(row.id) ?? []
    })
  );
}

export async function getFeed(options: { cursor?: string; limit?: number; viewerId?: string | null }): Promise<FeedResponse> {
  const db = getDb();
  const limit = options.limit ?? defaultLimit;
  const cursor = decodeCursor(options.cursor);

  const likedByMeSql = options.viewerId
    ? sql<boolean>`coalesce(bool_or(${likes.userId} = ${options.viewerId}), false)`
    : sql<boolean>`false`;

  const query = db
    .select({
      id: posts.id,
      content: posts.content,
      location: posts.location,
      type: posts.type,
      createdAt: posts.createdAt,
      likeCount: sql<number>`count(${likes.userId})::int`,
      commentCount: sql<number>`(select count(*)::int from posts as replies where replies.parent_id = ${posts.id})`,
      likedByMe: likedByMeSql,
      authorId: users.id,
      authorUsername: users.username,
      authorAvatarUrl: users.avatarUrl
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(
      cursor
        ? and(
            isNull(posts.parentId),
            or(
              lt(posts.createdAt, cursor.createdAt),
              and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id))
            )
          )
        : isNull(posts.parentId)
    )
    .groupBy(posts.id, users.id)
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);

  const rows = await query;
  const nextRow = rows.length > limit ? rows[limit] : null;
  const pageRows = rows.slice(0, limit);
  const mediaMap = await getMediaByPostIds(pageRows.map((row) => row.id));
  const items = pageRows.map((row) =>
    mapFeedPost({
      ...row,
      media: mediaMap.get(row.id) ?? []
    })
  );

  return {
    items,
    nextCursor: nextRow
      ? encodeCursor({
          id: nextRow.id,
          createdAt: nextRow.createdAt.toISOString()
        })
      : null
  };
}

export async function toggleLike(postId: string, userId: string): Promise<ToggleLikeResponse | null> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const post = await tx.query.posts.findFirst({
      where: eq(posts.id, postId),
      columns: { id: true }
    });

    if (!post) {
      return null;
    }

    const existingLike = await tx.query.likes.findFirst({
      where: and(eq(likes.postId, postId), eq(likes.userId, userId))
    });

    if (existingLike) {
      await tx.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userId, userId)));
    } else {
      await tx.insert(likes).values({
        postId,
        userId
      });
    }

    const [countResult] = await tx
      .select({
        likeCount: sql<number>`count(${likes.userId})::int`
      })
      .from(likes)
      .where(eq(likes.postId, postId));

    return {
      postId,
      likedByMe: !existingLike,
      likeCount: Number(countResult?.likeCount ?? 0)
    };
  });
}

export async function getComments(postId: string, viewerId?: string | null) {
  const db = getDb();

  const likedByMeSql = viewerId
    ? sql<boolean>`coalesce(bool_or(${likes.userId} = ${viewerId}), false)`
    : sql<boolean>`false`;

  const rows = await db
    .select({
      id: posts.id,
      content: posts.content,
      location: posts.location,
      type: posts.type,
      createdAt: posts.createdAt,
      likeCount: sql<number>`count(${likes.userId})::int`,
      commentCount: sql<number>`(select count(*)::int from posts as replies where replies.parent_id = ${posts.id})`,
      likedByMe: likedByMeSql,
      authorId: users.id,
      authorUsername: users.username,
      authorAvatarUrl: users.avatarUrl
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(eq(posts.parentId, postId))
    .groupBy(posts.id, users.id)
    .orderBy(asc(posts.createdAt), asc(posts.id));

  const mediaMap = await getMediaByPostIds(rows.map((row) => row.id));

  return rows.map((row) =>
    mapFeedPost({
      ...row,
      media: mediaMap.get(row.id) ?? []
    })
  );
}

export async function createPost(input: CreatePostInput, userId: string, files: UploadMediaFile[] = []) {
  const db = getDb();
  const uploadedMedia = await Promise.all(files.map((file, index) => uploadPostMedia(file, userId, index)));

  const [createdPost] = await db.transaction(async (tx) => {
    const [insertedPost] = await tx
      .insert(posts)
      .values({
        authorId: userId,
        content: input.content ?? null,
        location: input.location ?? null,
        type: "post"
      })
      .returning({ id: posts.id });

    if (!insertedPost) {
      throw new Error("Failed to create post.");
    }

    if (uploadedMedia.length > 0) {
      await tx.insert(media).values(
        uploadedMedia.map((item) => ({
          postId: insertedPost.id,
          url: item.url,
          type: item.type,
          sortOrder: item.sortOrder
        }))
      );
    }

    return [insertedPost] as const;
  });

  if (!createdPost) {
    throw new Error("Failed to create post.");
  }

  const post = await getPostById(createdPost.id, userId);

  if (!post) {
    throw new Error("Created post could not be loaded.");
  }

  return post;
}

export async function createComment(postId: string, input: CreateCommentInput, userId: string) {
  const db = getDb();

  const [createdComment] = await db.transaction(async (tx) => {
    const parentPost = await tx.query.posts.findFirst({
      where: eq(posts.id, postId),
      columns: { id: true }
    });

    if (!parentPost) {
      return [];
    }

    const [insertedComment] = await tx
      .insert(posts)
      .values({
        authorId: userId,
        content: input.content,
        type: "reply",
        parentId: postId
      })
      .returning({ id: posts.id });

    return insertedComment ? [insertedComment] : [];
  });

  if (!createdComment) {
    return null;
  }

  return getPostById(createdComment.id, userId);
}

export async function getPostsByAuthor(userId: string, viewerId?: string | null) {
  const posts = await getPostsByAuthorIds([userId], viewerId);
  return posts.filter((post) => post.author.id === userId);
}

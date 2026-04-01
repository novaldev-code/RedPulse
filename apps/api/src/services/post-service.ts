import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { follows, getDb, likes, media, posts, savedPosts, users } from "@redpulse/db";
import type {
  CreateCommentInput,
  CreatePostInput,
  DeletePostResponse,
  DeleteCommentResponse,
  FeedPost,
  FeedResponse,
  FeedScope,
  PostMedia,
  ToggleLikeResponse
} from "@redpulse/validation";
import { uploadPostMedia, type UploadMediaFile } from "../lib/media.js";
import { createNotification, createNotifications } from "./notification-service.js";

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
  savedByMe: boolean;
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
    savedByMe: row.savedByMe,
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
  const savedByMeSql = viewerId
    ? sql<boolean>`exists(select 1 from ${savedPosts} saved where saved.post_id = ${posts.id} and saved.user_id = ${viewerId})`
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
      savedByMe: savedByMeSql,
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
  const savedByMeSql = viewerId
    ? sql<boolean>`exists(select 1 from ${savedPosts} saved where saved.post_id = ${posts.id} and saved.user_id = ${viewerId})`
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
      savedByMe: savedByMeSql,
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

export async function getFeed(options: {
  cursor?: string;
  limit?: number;
  viewerId?: string | null;
  scope?: FeedScope;
}): Promise<FeedResponse> {
  const db = getDb();
  const limit = options.limit ?? defaultLimit;
  const cursor = decodeCursor(options.cursor);
  const scope = options.scope ?? "global";

  const likedByMeSql = options.viewerId
    ? sql<boolean>`coalesce(bool_or(${likes.userId} = ${options.viewerId}), false)`
    : sql<boolean>`false`;
  const savedByMeSql = options.viewerId
    ? sql<boolean>`exists(select 1 from ${savedPosts} saved where saved.post_id = ${posts.id} and saved.user_id = ${options.viewerId})`
    : sql<boolean>`false`;

  const followedAuthorIds =
    scope === "following" && options.viewerId
      ? [
          options.viewerId,
          ...(
            await db
              .select({ followingId: follows.followingId })
              .from(follows)
              .where(eq(follows.followerId, options.viewerId))
          ).map((row) => row.followingId)
        ]
      : null;

  const baseWhere =
    scope === "following"
      ? followedAuthorIds && followedAuthorIds.length > 0
        ? and(isNull(posts.parentId), inArray(posts.authorId, followedAuthorIds))
        : sql`false`
      : isNull(posts.parentId);

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
      savedByMe: savedByMeSql,
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
            baseWhere,
            or(
              lt(posts.createdAt, cursor.createdAt),
              and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id))
            )
          )
        : baseWhere
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
  let shouldNotify = false;
  let postAuthorId: string | null = null;
  let actorUsername: string | null = null;

  const result = await db.transaction(async (tx) => {
    const post = await tx.query.posts.findFirst({
      where: eq(posts.id, postId),
      columns: { id: true, authorId: true }
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
      shouldNotify = post.authorId !== userId;
      postAuthorId = post.authorId;

      const actor = await tx.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          username: true
        }
      });
      actorUsername = actor?.username ?? null;
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

  if (result && shouldNotify && postAuthorId && actorUsername) {
    await createNotification({
      userId: postAuthorId,
      actorId: userId,
      type: "like",
      entityId: postId,
      message: `@${actorUsername} memberi Pulse ke post Anda.`
    });
  }

  return result;
}

export async function toggleSave(postId: string, userId: string) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const post = await tx.query.posts.findFirst({
      where: eq(posts.id, postId),
      columns: { id: true }
    });

    if (!post) {
      return null;
    }

    const existingSave = await tx.query.savedPosts.findFirst({
      where: and(eq(savedPosts.postId, postId), eq(savedPosts.userId, userId))
    });

    if (existingSave) {
      await tx.delete(savedPosts).where(and(eq(savedPosts.postId, postId), eq(savedPosts.userId, userId)));
    } else {
      await tx.insert(savedPosts).values({
        postId,
        userId
      });
    }

    return {
      postId,
      savedByMe: !existingSave
    };
  });
}

export async function getComments(postId: string, viewerId?: string | null) {
  const db = getDb();

  const likedByMeSql = viewerId
    ? sql<boolean>`coalesce(bool_or(${likes.userId} = ${viewerId}), false)`
    : sql<boolean>`false`;
  const savedByMeSql = viewerId
    ? sql<boolean>`exists(select 1 from ${savedPosts} saved where saved.post_id = ${posts.id} and saved.user_id = ${viewerId})`
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
      savedByMe: savedByMeSql,
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
  const author = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      username: true
    }
  });

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

  const followersRows = await db
    .select({
      userId: follows.followerId
    })
    .from(follows)
    .where(eq(follows.followingId, userId));

  if (author) {
    await createNotifications({
      userIds: followersRows.map((row) => row.userId),
      actorId: userId,
      type: "post",
      entityId: createdPost.id,
      message: `@${author.username} membagikan post baru.`
    });
  }

  return post;
}

export async function createComment(postId: string, input: CreateCommentInput, userId: string) {
  const db = getDb();
  let parentAuthorId: string | null = null;
  let actorUsername: string | null = null;

  const [createdComment] = await db.transaction(async (tx) => {
    const parentPost = await tx.query.posts.findFirst({
      where: eq(posts.id, postId),
      columns: { id: true, authorId: true }
    });

    if (!parentPost) {
      return [];
    }

    parentAuthorId = parentPost.authorId;

    const [insertedComment] = await tx
      .insert(posts)
      .values({
        authorId: userId,
        content: input.content,
        type: "reply",
        parentId: postId
      })
      .returning({ id: posts.id });

    const actor = await tx.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        username: true
      }
    });
    actorUsername = actor?.username ?? null;

    return insertedComment ? [insertedComment] : [];
  });

  if (!createdComment) {
    return null;
  }

  if (parentAuthorId && parentAuthorId !== userId && actorUsername) {
    await createNotification({
      userId: parentAuthorId,
      actorId: userId,
      type: "comment",
      entityId: postId,
      message: `@${actorUsername} mengomentari post Anda.`
    });
  }

  return getPostById(createdComment.id, userId);
}

export async function updateComment(commentId: string, input: CreateCommentInput, userId: string) {
  const db = getDb();

  const existingComment = await db.query.posts.findFirst({
    where: eq(posts.id, commentId),
    columns: {
      id: true,
      authorId: true,
      parentId: true
    }
  });

  if (!existingComment || !existingComment.parentId) {
    return null;
  }

  if (existingComment.authorId !== userId) {
    return "forbidden" as const;
  }

  await db
    .update(posts)
    .set({
      content: input.content
    })
    .where(eq(posts.id, commentId));

  return getPostById(commentId, userId);
}

export async function deleteComment(commentId: string, userId: string): Promise<DeleteCommentResponse | "forbidden" | null> {
  const db = getDb();

  const existingComment = await db.query.posts.findFirst({
    where: eq(posts.id, commentId),
    columns: {
      id: true,
      authorId: true,
      parentId: true
    }
  });

  if (!existingComment || !existingComment.parentId) {
    return null;
  }

  if (existingComment.authorId !== userId) {
    return "forbidden";
  }

  await db.delete(posts).where(eq(posts.id, commentId));

  return {
    commentId,
    postId: existingComment.parentId
  };
}

export async function getPostsByAuthor(userId: string, viewerId?: string | null) {
  const posts = await getPostsByAuthorIds([userId], viewerId);
  return posts.filter((post) => post.author.id === userId);
}

export async function getSavedPosts(userId: string) {
  const db = getDb();

  const likedByMeSql = sql<boolean>`coalesce(bool_or(${likes.userId} = ${userId}), false)`;
  const savedByMeSql = sql<boolean>`true`;

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
      savedByMe: savedByMeSql,
      authorId: users.id,
      authorUsername: users.username,
      authorAvatarUrl: users.avatarUrl,
      savedAt: savedPosts.createdAt
    })
    .from(savedPosts)
    .innerJoin(posts, eq(savedPosts.postId, posts.id))
    .innerJoin(users, eq(posts.authorId, users.id))
    .leftJoin(likes, eq(likes.postId, posts.id))
    .where(and(eq(savedPosts.userId, userId), isNull(posts.parentId)))
    .groupBy(posts.id, users.id, savedPosts.createdAt)
    .orderBy(desc(savedPosts.createdAt), desc(posts.id));

  const mediaMap = await getMediaByPostIds(rows.map((row) => row.id));

  return rows.map((row) =>
    mapFeedPost({
      ...row,
      media: mediaMap.get(row.id) ?? []
    })
  );
}

export async function deletePost(
  postId: string,
  userId: string
): Promise<DeletePostResponse | null | "forbidden"> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const post = await tx.query.posts.findFirst({
      where: eq(posts.id, postId),
      columns: {
        id: true,
        authorId: true,
        parentId: true
      }
    });

    if (!post) {
      return null;
    }

    if (post.authorId !== userId) {
      return "forbidden";
    }

    await tx.delete(posts).where(eq(posts.parentId, postId));
    await tx.delete(posts).where(eq(posts.id, postId));

    return {
      postId
    };
  });
}

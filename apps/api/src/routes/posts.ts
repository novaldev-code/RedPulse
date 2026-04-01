import { Router, type Request, type Router as ExpressRouter } from "express";
import multer from "multer";
import {
  commentParamsSchema,
  createCommentSchema,
  createPostSchema,
  deletePostParamsSchema,
  feedQuerySchema,
  postCommentsParamsSchema,
  toggleLikeParamsSchema
} from "@redpulse/validation";
import { authenticate } from "../middleware/auth.js";
import { isSupportedMediaMimeType } from "../lib/media.js";
import { createRateLimiter } from "../lib/rate-limit.js";
import { createComment, createPost, deleteComment, deletePost, getComments, getFeed, getSavedPosts, toggleLike, toggleSave, updateComment } from "../services/post-service.js";

export const postsRouter: ExpressRouter = Router();

const createPostLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  keyPrefix: "create-post",
  message: "Terlalu banyak post dalam waktu singkat. Coba lagi beberapa menit lagi."
});

const commentLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  keyPrefix: "comment",
  message: "Komentar Anda terlalu cepat. Beri jeda sebentar lalu coba lagi."
});

const postActionLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 80,
  keyPrefix: "post-action",
  message: "Aksi ke post terlalu cepat. Coba lagi sebentar."
});

const postUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 4
  },
  fileFilter: (
    _request: Request,
    file: { mimetype: string },
    callback: (error: Error | null, acceptFile?: boolean) => void
  ) => {
    if (!isSupportedMediaMimeType(file.mimetype)) {
      callback(new Error("Only image and video uploads are supported."));
      return;
    }

    callback(null, true);
  }
});

postsRouter.get("/api/posts", async (request, response) => {
  const parsed = feedQuerySchema.safeParse(request.query);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid feed query.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const feed = await getFeed({
    cursor: parsed.data.cursor,
    limit: parsed.data.limit,
    scope: parsed.data.scope,
    viewerId: request.user?.id ?? null
  });

  response.json(feed);
});

postsRouter.get("/api/saved-posts", authenticate, async (request, response) => {
  const items = await getSavedPosts(request.user!.id);

  response.json({
    items
  });
});

postsRouter.post("/api/posts", authenticate, createPostLimiter, postUpload.array("media", 4), async (request, response) => {
  const parsed = createPostSchema.safeParse({
    content: typeof request.body.content === "string" ? request.body.content : undefined,
    location: typeof request.body.location === "string" ? request.body.location : undefined
  });

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid post payload.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const files = Array.isArray(request.files) ? request.files : [];

  if (!parsed.data.content && files.length === 0) {
    response.status(400).json({
      message: "Post content or media is required."
    });
    return;
  }

  const post = await createPost(parsed.data, request.user!.id, files);

  response.status(201).json({
    post
  });
});

postsRouter.delete("/api/posts/:id", authenticate, postActionLimiter, async (request, response) => {
  const parsed = deletePostParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid post id.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const result = await deletePost(parsed.data.id, request.user!.id);

  if (!result) {
    response.status(404).json({
      message: "Post not found."
    });
    return;
  }

  if (result === "forbidden") {
    response.status(403).json({
      message: "Anda tidak bisa menghapus post milik akun lain."
    });
    return;
  }

  response.json(result);
});

postsRouter.get("/api/posts/:id/comments", async (request, response) => {
  const parsed = postCommentsParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid post id.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const comments = await getComments(parsed.data.id, request.user?.id ?? null);

  response.json({
    comments
  });
});

postsRouter.post("/api/posts/:id/comments", authenticate, commentLimiter, async (request, response) => {
  const parsedParams = postCommentsParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    response.status(400).json({
      message: "Invalid post id.",
      issues: parsedParams.error.flatten()
    });
    return;
  }

  const parsedBody = createCommentSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json({
      message: "Invalid comment payload.",
      issues: parsedBody.error.flatten()
    });
    return;
  }

  const comment = await createComment(parsedParams.data.id, parsedBody.data, request.user!.id);

  if (!comment) {
    response.status(404).json({
      message: "Post not found."
    });
    return;
  }

  response.status(201).json({
    comment
  });
});

postsRouter.patch("/api/comments/:id", authenticate, commentLimiter, async (request, response) => {
  const parsedParams = commentParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    response.status(400).json({
      message: "Invalid comment id.",
      issues: parsedParams.error.flatten()
    });
    return;
  }

  const parsedBody = createCommentSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json({
      message: "Invalid comment payload.",
      issues: parsedBody.error.flatten()
    });
    return;
  }

  const comment = await updateComment(parsedParams.data.id, parsedBody.data, request.user!.id);

  if (!comment) {
    response.status(404).json({
      message: "Comment not found."
    });
    return;
  }

  if (comment === "forbidden") {
    response.status(403).json({
      message: "Anda tidak bisa mengedit komentar milik akun lain."
    });
    return;
  }

  response.json({
    comment
  });
});

postsRouter.delete("/api/comments/:id", authenticate, postActionLimiter, async (request, response) => {
  const parsed = commentParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid comment id.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const result = await deleteComment(parsed.data.id, request.user!.id);

  if (!result) {
    response.status(404).json({
      message: "Comment not found."
    });
    return;
  }

  if (result === "forbidden") {
    response.status(403).json({
      message: "Anda tidak bisa menghapus komentar milik akun lain."
    });
    return;
  }

  response.json(result);
});

postsRouter.post("/api/posts/:id/like", authenticate, postActionLimiter, async (request, response) => {
  const parsed = toggleLikeParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid post id.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const result = await toggleLike(parsed.data.id, request.user!.id);

  if (!result) {
    response.status(404).json({
      message: "Post not found."
    });
    return;
  }

  response.json(result);
});

postsRouter.post("/api/posts/:id/save", authenticate, postActionLimiter, async (request, response) => {
  const parsed = toggleLikeParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid post id.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const result = await toggleSave(parsed.data.id, request.user!.id);

  if (!result) {
    response.status(404).json({
      message: "Post not found."
    });
    return;
  }

  response.json(result);
});

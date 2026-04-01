import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import {
  createCommentSchema,
  createPostSchema,
  feedQuerySchema,
  postCommentsParamsSchema,
  toggleLikeParamsSchema
} from "@redpulse/validation";
import { authenticate } from "../middleware/auth.js";
import { isSupportedMediaMimeType } from "../lib/media.js";
import { createComment, createPost, getComments, getFeed, toggleLike } from "../services/post-service.js";

export const postsRouter: ExpressRouter = Router();

const postUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 4
  },
  fileFilter: (_request, file, callback) => {
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
    viewerId: request.user?.id ?? null
  });

  response.json(feed);
});

postsRouter.post("/api/posts", authenticate, postUpload.array("media", 4), async (request, response) => {
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

postsRouter.post("/api/posts/:id/comments", authenticate, async (request, response) => {
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

postsRouter.post("/api/posts/:id/like", authenticate, async (request, response) => {
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

import type { Express, NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import express from "express";
import multer from "multer";
import { authRouter } from "./routes/auth.js";
import { postsRouter } from "./routes/posts.js";
import { usersRouter } from "./routes/users.js";
import { attachAuthUser } from "./middleware/auth.js";

export const app: Express = express();

app.use(express.json());
app.use(cookieParser());
app.use(attachAuthUser);

app.get("/health", (_request, response) => {
  response.json({
    status: "ok"
  });
});

app.use(authRouter);
app.use(postsRouter);
app.use(usersRouter);

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    response.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "Ukuran file terlalu besar. Maksimal 25MB per file."
          : "Upload media tidak valid."
    });
    return;
  }

  if (error instanceof Error && error.message === "Only image and video uploads are supported.") {
    response.status(400).json({
      message: error.message
    });
    return;
  }

  if (error instanceof Error && error.message === "Cloudinary media upload is not configured.") {
    response.status(500).json({
      message: "Upload media belum dikonfigurasi di server."
    });
    return;
  }

  response.status(500).json({
    message: "Internal server error."
  });
});

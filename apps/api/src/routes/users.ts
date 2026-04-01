import { Router, type Router as ExpressRouter } from "express";
import { toggleFollowParamsSchema } from "@redpulse/validation";
import { authenticate } from "../middleware/auth.js";
import { getProfileSummary, getPublicProfile, getSuggestedUsers, toggleFollow } from "../services/social-service.js";

export const usersRouter: ExpressRouter = Router();

usersRouter.get("/api/profile/me", authenticate, async (request, response) => {
  const profile = await getProfileSummary(request.user!.id);

  if (!profile) {
    response.status(404).json({
      message: "Profile not found."
    });
    return;
  }

  response.json({ profile });
});

usersRouter.get("/api/users/suggestions", async (request, response) => {
  const users = await getSuggestedUsers(request.user?.id ?? null);
  response.json({ users });
});

usersRouter.get("/api/users/:id/profile", async (request, response) => {
  const parsed = toggleFollowParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid user id.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const profile = await getPublicProfile(parsed.data.id, request.user?.id ?? null);

  if (!profile) {
    response.status(404).json({
      message: "Profile not found."
    });
    return;
  }

  response.json(profile);
});

usersRouter.post("/api/users/:id/follow", authenticate, async (request, response) => {
  const parsed = toggleFollowParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid user id.",
      issues: parsed.error.flatten()
    });
    return;
  }

  if (parsed.data.id === request.user!.id) {
    response.status(400).json({
      message: "You cannot follow yourself."
    });
    return;
  }

  const result = await toggleFollow(parsed.data.id, request.user!.id);

  if (!result) {
    response.status(404).json({
      message: "User not found."
    });
    return;
  }

  response.json(result);
});

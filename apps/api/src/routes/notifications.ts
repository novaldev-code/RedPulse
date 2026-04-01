import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/auth.js";
import { getNotifications, markAllNotificationsRead } from "../services/notification-service.js";

export const notificationsRouter: ExpressRouter = Router();

notificationsRouter.get("/api/notifications", authenticate, async (request, response) => {
  const result = await getNotifications(request.user!.id);
  response.json(result);
});

notificationsRouter.post("/api/notifications/read-all", authenticate, async (request, response) => {
  const result = await markAllNotificationsRead(request.user!.id);
  response.json(result);
});

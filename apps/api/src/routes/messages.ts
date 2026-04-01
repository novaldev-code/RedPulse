import { Router, type Router as ExpressRouter } from "express";
import {
  conversationMessagesParamsSchema,
  sendDirectMessageParamsSchema,
  sendDirectMessageSchema
} from "@redpulse/validation";
import { createRateLimiter } from "../lib/rate-limit.js";
import { authenticate } from "../middleware/auth.js";
import { getConversationList, getConversationMessages, sendDirectMessage } from "../services/message-service.js";

export const messagesRouter: ExpressRouter = Router();

const messageSendLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 40,
  keyPrefix: "message-send",
  message: "Pesan dikirim terlalu cepat. Coba lagi sebentar."
});

messagesRouter.get("/api/messages/conversations", authenticate, async (request, response) => {
  const conversations = await getConversationList(request.user!.id);

  response.json({
    conversations
  });
});

messagesRouter.get("/api/messages/:id", authenticate, async (request, response) => {
  const parsed = conversationMessagesParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid conversation id.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const conversation = await getConversationMessages(parsed.data.id, request.user!.id);

  if (!conversation) {
    response.status(404).json({
      message: "Conversation not found."
    });
    return;
  }

  response.json(conversation);
});

messagesRouter.post("/api/messages/direct/:userId", authenticate, messageSendLimiter, async (request, response) => {
  const parsedParams = sendDirectMessageParamsSchema.safeParse(request.params);

  if (!parsedParams.success) {
    response.status(400).json({
      message: "Invalid user id.",
      issues: parsedParams.error.flatten()
    });
    return;
  }

  const parsedBody = sendDirectMessageSchema.safeParse(request.body);

  if (!parsedBody.success) {
    response.status(400).json({
      message: "Invalid message payload.",
      issues: parsedBody.error.flatten()
    });
    return;
  }

  try {
    const result = await sendDirectMessage(request.user!.id, parsedParams.data.userId, parsedBody.data.content);

    if (!result) {
      response.status(404).json({
        message: "Recipient not found."
      });
      return;
    }

    response.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "You cannot send a message to yourself.") {
      response.status(400).json({
        message: error.message
      });
      return;
    }

    throw error;
  }
});

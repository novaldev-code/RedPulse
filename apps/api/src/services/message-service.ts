import { and, desc, eq, inArray } from "drizzle-orm";
import { conversationParticipants, conversations, directMessages, getDb, users } from "@redpulse/db";
import { createNotification } from "./notification-service.js";

function createDirectKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].sort().join(":");
}

type ConversationParticipantSummary = {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
};

type DirectMessageSummary = {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender: ConversationParticipantSummary;
};

type ConversationSummary = {
  id: string;
  participant: ConversationParticipantSummary;
  lastMessage: DirectMessageSummary | null;
  updatedAt: string;
};

async function ensureUserExists(userId: string) {
  const db = getDb();

  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true
    }
  });
}

async function getOrCreateDirectConversation(userId: string, otherUserId: string) {
  const db = getDb();
  const directKey = createDirectKey(userId, otherUserId);

  const existingConversation = await db.query.conversations.findFirst({
    where: eq(conversations.directKey, directKey),
    columns: {
      id: true,
      directKey: true,
      createdAt: true
    }
  });

  if (existingConversation) {
    return existingConversation;
  }

  const [conversation] = await db
    .insert(conversations)
    .values({
      directKey
    })
    .returning({
      id: conversations.id,
      directKey: conversations.directKey,
      createdAt: conversations.createdAt
    });

  if (!conversation) {
    throw new Error("Failed to create conversation.");
  }

  await db.insert(conversationParticipants).values([
    {
      conversationId: conversation.id,
      userId
    },
    {
      conversationId: conversation.id,
      userId: otherUserId
    }
  ]);

  return conversation;
}

async function getConversationSummariesByIds(conversationIds: string[], viewerId: string) {
  if (conversationIds.length === 0) {
    return [] as ConversationSummary[];
  }

  const db = getDb();

  const [messageRows, conversationRows, allParticipants] = await Promise.all([
    db
      .select({
        id: directMessages.id,
        conversationId: directMessages.conversationId,
        content: directMessages.content,
        createdAt: directMessages.createdAt,
        senderId: directMessages.senderId,
        senderUsername: users.username,
        senderAvatarUrl: users.avatarUrl,
        senderBio: users.bio
      })
      .from(directMessages)
      .innerJoin(users, eq(directMessages.senderId, users.id))
      .where(inArray(directMessages.conversationId, conversationIds))
      .orderBy(desc(directMessages.createdAt), desc(directMessages.id)),
    db
      .select({
        id: conversations.id,
        createdAt: conversations.createdAt
      })
      .from(conversations)
      .where(inArray(conversations.id, conversationIds)),
    db
      .select({
        conversationId: conversationParticipants.conversationId,
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
        bio: users.bio
      })
      .from(conversationParticipants)
      .innerJoin(users, eq(conversationParticipants.userId, users.id))
      .where(inArray(conversationParticipants.conversationId, conversationIds))
  ]);

  const participantMap = new Map<string, ConversationParticipantSummary>();

  for (const row of allParticipants) {
    if (row.id === viewerId) {
      continue;
    }

    participantMap.set(row.conversationId, {
      id: row.id,
      username: row.username,
      avatarUrl: row.avatarUrl,
      bio: row.bio
    });
  }

  const latestMessageMap = new Map<string, DirectMessageSummary>();

  for (const row of messageRows) {
    if (latestMessageMap.has(row.conversationId)) {
      continue;
    }

    latestMessageMap.set(row.conversationId, {
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      senderId: row.senderId,
      sender: {
        id: row.senderId,
        username: row.senderUsername,
        avatarUrl: row.senderAvatarUrl,
        bio: row.senderBio
      }
    });
  }

  return conversationRows
    .map((conversation) => {
      const participant = participantMap.get(conversation.id);

      if (!participant) {
        return null;
      }

      const lastMessage = latestMessageMap.get(conversation.id) ?? null;

      return {
        id: conversation.id,
        participant,
        lastMessage,
        updatedAt: (lastMessage?.createdAt ? new Date(lastMessage.createdAt) : conversation.createdAt).toISOString()
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right!.updatedAt).getTime() - new Date(left!.updatedAt).getTime()) as ConversationSummary[];
}

export async function getConversationList(viewerId: string) {
  const db = getDb();
  const rows = await db
    .select({
      conversationId: conversationParticipants.conversationId
    })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, viewerId));

  return getConversationSummariesByIds(
    rows.map((row) => row.conversationId),
    viewerId
  );
}

export async function getConversationMessages(conversationId: string, viewerId: string) {
  const db = getDb();

  const participantRecord = await db.query.conversationParticipants.findFirst({
    where: and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, viewerId)),
    columns: {
      conversationId: true
    }
  });

  if (!participantRecord) {
    return null;
  }

  const [conversation] = await getConversationSummariesByIds([conversationId], viewerId);

  if (!conversation) {
    return null;
  }

  const rows = await db
    .select({
      id: directMessages.id,
      content: directMessages.content,
      createdAt: directMessages.createdAt,
      senderId: directMessages.senderId,
      senderUsername: users.username,
      senderAvatarUrl: users.avatarUrl,
      senderBio: users.bio
    })
    .from(directMessages)
    .innerJoin(users, eq(directMessages.senderId, users.id))
    .where(eq(directMessages.conversationId, conversationId))
    .orderBy(directMessages.createdAt, directMessages.id);

  return {
    conversation,
    messages: rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      senderId: row.senderId,
      sender: {
        id: row.senderId,
        username: row.senderUsername,
        avatarUrl: row.senderAvatarUrl,
        bio: row.senderBio
      }
    }))
  };
}

export async function sendDirectMessage(senderId: string, recipientId: string, content: string) {
  if (senderId === recipientId) {
    throw new Error("You cannot send a message to yourself.");
  }

  const recipient = await ensureUserExists(recipientId);

  if (!recipient) {
    return null;
  }

  const db = getDb();
  const conversation = await getOrCreateDirectConversation(senderId, recipientId);

  const [message] = await db
    .insert(directMessages)
    .values({
      conversationId: conversation.id,
      senderId,
      content
    })
    .returning({
      id: directMessages.id,
      content: directMessages.content,
      createdAt: directMessages.createdAt,
      senderId: directMessages.senderId
    });

  if (!message) {
    throw new Error("Failed to send direct message.");
  }

  const [summary] = await getConversationSummariesByIds([conversation.id], senderId);
  const sender = await db.query.users.findFirst({
    where: eq(users.id, senderId),
    columns: {
      id: true,
      username: true,
      avatarUrl: true,
      bio: true
    }
  });

  if (!summary || !sender) {
    throw new Error("Message conversation could not be loaded.");
  }

  await createNotification({
    userId: recipientId,
    actorId: senderId,
    type: "message",
    entityId: conversation.id,
    message: `@${sender.username} mengirim pesan baru untuk Anda.`
  });

  return {
    conversation: summary,
    message: {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      senderId: message.senderId,
      sender: {
        id: sender.id,
        username: sender.username,
        avatarUrl: sender.avatarUrl,
        bio: sender.bio
      }
    }
  };
}

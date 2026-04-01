import { desc, eq, sql } from "drizzle-orm";
import { getDb, notifications, users, type NewNotification } from "@redpulse/db";
import type { NotificationType, NotificationsResponse } from "@redpulse/validation";

type CreateNotificationInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  entityId?: string | null;
  message: string;
};

type CreateBulkNotificationsInput = {
  userIds: string[];
  actorId?: string | null;
  type: NotificationType;
  entityId?: string | null;
  message: string;
};

export async function createNotification(input: CreateNotificationInput) {
  if (input.actorId && input.actorId === input.userId) {
    return;
  }

  const db = getDb();

  await db.insert(notifications).values({
    userId: input.userId,
    actorId: input.actorId ?? null,
    type: input.type,
    entityId: input.entityId ?? null,
    message: input.message
  });
}

export async function createNotifications(input: CreateBulkNotificationsInput) {
  const uniqueUserIds = [...new Set(input.userIds)].filter((userId) => userId && userId !== input.actorId);

  if (uniqueUserIds.length === 0) {
    return;
  }

  const db = getDb();
  const values: NewNotification[] = uniqueUserIds.map((userId) => ({
    userId,
    actorId: input.actorId ?? null,
    type: input.type,
    entityId: input.entityId ?? null,
    message: input.message
  }));

  await db.insert(notifications).values(values);
}

export async function getNotifications(userId: string): Promise<NotificationsResponse> {
  const db = getDb();

  const [rows, unreadRows] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        entityId: notifications.entityId,
        message: notifications.message,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorId: users.id,
        actorUsername: users.username,
        actorAvatarUrl: users.avatarUrl
      })
      .from(notifications)
      .leftJoin(users, eq(notifications.actorId, users.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(40),
    db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(notifications)
      .where(sql`${notifications.userId} = ${userId} and ${notifications.readAt} is null`)
  ]);

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      entityId: row.entityId,
      message: row.message,
      readAt: row.readAt ? row.readAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      actor: row.actorId
        ? {
            id: row.actorId,
            username: row.actorUsername!,
            avatarUrl: row.actorAvatarUrl
          }
        : null
    })),
    unreadCount: Number(unreadRows[0]?.count ?? 0)
  };
}

export async function markAllNotificationsRead(userId: string) {
  const db = getDb();

  await db
    .update(notifications)
    .set({
      readAt: new Date()
    })
    .where(sql`${notifications.userId} = ${userId} and ${notifications.readAt} is null`);

  return {
    success: true,
    unreadCount: 0
  };
}

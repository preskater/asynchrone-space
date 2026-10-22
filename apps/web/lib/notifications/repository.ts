import type { PrismaClient } from "@workspace/db"

export class NotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  list(organizationId: string, userId: string, limit = 20) {
    return this.db.notification.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
  }

  countUnread(userId: string) {
    return this.db.notification.count({ where: { userId, readAt: null } })
  }

  create(data: {
    organizationId: string
    userId: string
    actorId: string | null
    type: string
    data?: unknown
  }) {
    return this.db.notification.create({
      data: { ...data, data: (data.data ?? undefined) as never },
    })
  }

  /** Only the recipient can mark their own notifications as read. */
  markRead(userId: string, id: string) {
    return this.db.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    })
  }

  markAllRead(userId: string) {
    return this.db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
  }
}

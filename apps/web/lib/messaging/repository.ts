import type { PrismaClient } from "@workspace/db"

export const messageInclude = {
  reactions: true,
  attachments: true,
  replies: {
    orderBy: { createdAt: "asc" as const },
    include: { reactions: true, attachments: true },
  },
}

export class MessagingRepository {
  constructor(private readonly db: PrismaClient) {}

  listConversations(organizationId: string) {
    return this.db.conversation.findMany({
      where: { organizationId },
      include: { members: true },
      orderBy: { lastMessageAt: "desc" },
    })
  }

  findConversation(organizationId: string, id: string) {
    return this.db.conversation.findFirst({
      where: { id, organizationId },
      include: { members: true },
    })
  }

  findDm(organizationId: string, currentUserId: string, partnerId: string) {
    return this.db.conversation.findFirst({
      where: {
        organizationId,
        kind: "dm",
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: partnerId } } },
        ],
      },
      include: { members: true },
    })
  }

  createConversation(data: {
    organizationId: string
    kind: string
    name: string
    teamId?: string | null
    topic?: string
    memberIds: string[]
  }) {
    return this.db.conversation.create({
      data: {
        organizationId: data.organizationId,
        kind: data.kind,
        name: data.name,
        teamId: data.teamId ?? null,
        topic: data.topic,
        members: { create: data.memberIds.map((userId) => ({ userId })) },
      },
      include: { members: true },
    })
  }

  updateConversation(
    id: string,
    data: { unreadCount?: number; muted?: boolean; pinned?: boolean; lastMessageAt?: Date }
  ) {
    return this.db.conversation.update({
      where: { id },
      data,
      include: { members: true },
    })
  }

  listTeams(organizationId: string) {
    return this.db.chatTeam.findMany({
      where: { organizationId },
      include: { conversations: { select: { id: true } } },
      orderBy: { createdAt: "asc" },
    })
  }

  findTeam(organizationId: string, id: string) {
    return this.db.chatTeam.findFirst({
      where: { id, organizationId },
      include: { conversations: { select: { id: true } } },
    })
  }

  listMessages(organizationId: string) {
    return this.db.message.findMany({
      where: { conversation: { organizationId } },
      include: messageInclude,
      orderBy: { createdAt: "asc" },
    })
  }

  findMessage(organizationId: string, id: string) {
    return this.db.message.findFirst({
      where: { id, conversation: { organizationId } },
      include: messageInclude,
    })
  }

  createMessage(data: {
    conversationId: string
    authorId: string
    body: string
    parentId?: string | null
    meetingTitle?: string
    meetingStartsAt?: Date
    meetingDuration?: number
    attachments?: {
      name: string
      kind: string
      meta?: string
      oid?: number
      mimeType?: string
      sha256?: string
      sizeBytes?: number
    }[]
  }) {
    return this.db.message.create({
      data: {
        conversationId: data.conversationId,
        authorId: data.authorId,
        body: data.body,
        parentId: data.parentId ?? null,
        meetingTitle: data.meetingTitle,
        meetingStartsAt: data.meetingStartsAt,
        meetingDuration: data.meetingDuration,
        attachments: data.attachments?.length
          ? {
              create: data.attachments.map((attachment) => ({
                name: attachment.name,
                kind: attachment.kind,
                meta: attachment.meta,
                oid: attachment.oid,
                mimeType: attachment.mimeType,
                sha256: attachment.sha256,
                sizeBytes: attachment.sizeBytes,
              })),
            }
          : undefined,
      },
      include: messageInclude,
    })
  }

  updateMessage(id: string, data: { body?: string; edited?: boolean }) {
    return this.db.message.update({
      where: { id },
      data,
      include: messageInclude,
    })
  }

  deleteMessage(id: string) {
    return this.db.message.delete({ where: { id } })
  }

  toggleReaction(messageId: string, emoji: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.messageReaction.findUnique({
        where: { messageId_emoji_userId: { messageId, emoji, userId } },
      })
      if (existing) {
        await tx.messageReaction.delete({ where: { id: existing.id } })
        return false
      }
      await tx.messageReaction.create({ data: { messageId, emoji, userId } })
      return true
    })
  }
}

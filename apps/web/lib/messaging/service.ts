import { ForbiddenError, NotFoundError } from "@/lib/core/errors"
import type { RequestContext } from "@/lib/core/context"
import { unlinkLargeObject } from "@/lib/large-object"
import { roleRank } from "@/lib/organization/roles"
import { prisma } from "@/lib/prisma"

import { MessagingRepository } from "./repository"
import type {
  AddThreadReplyInput,
  CreateChannelInput,
  EditMessageInput,
  SendMessageInput,
  SetTypingInput,
  StartDmInput,
  ToggleReactionInput,
} from "./schemas"
import type {
  Conversation,
  Message,
  MessagingData,
  Presence,
  Reaction,
  Team,
} from "./types"

function canWrite(ctx: RequestContext) {
  if (roleRank(ctx.role) >= 2) return
  throw new ForbiddenError("Your role cannot send messages.", {
    code: "role_cannot_send_messages",
  })
}

/** Only the author (or an admin/owner) may edit or delete a message. */
function assertAuthor(ctx: RequestContext, authorId: string) {
  if (authorId === ctx.userId || ctx.role === "owner" || ctx.role === "admin")
    return
  throw new ForbiddenError("You can only modify your own messages.", {
    code: "message_not_author",
  })
}

type ConversationRow = Awaited<
  ReturnType<MessagingRepository["listConversations"]>
>[number]
type MessageRow = Awaited<
  ReturnType<MessagingRepository["listMessages"]>
>[number]
type TeamRow = Awaited<ReturnType<MessagingRepository["listTeams"]>>[number]

export class MessagingService {
  constructor(private readonly repo: MessagingRepository) {}

  private mapConversation(row: ConversationRow): Conversation {
    return {
      id: row.id,
      kind: row.kind as Conversation["kind"],
      name: row.name,
      teamId: row.teamId ?? undefined,
      memberIds: row.members.map((member) => member.userId),
      topic: row.topic ?? undefined,
      unreadCount: row.unreadCount,
      lastMessageAt: row.lastMessageAt.toISOString(),
      muted: row.muted,
      pinned: row.pinned,
    }
  }

  private mapMessage(row: MessageRow): Message {
    return {
      id: row.id,
      conversationId: row.conversationId,
      authorId: row.authorId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      reactions: this.mapReactions(row),
      attachments: row.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        kind: attachment.kind as Message["attachments"][number]["kind"],
        meta: attachment.meta ?? undefined,
        sizeBytes: attachment.sizeBytes ?? undefined,
        hasStorage: attachment.oid !== null,
      })),
      parentId: row.parentId ?? undefined,
      edited: row.edited,
      system: row.system,
      meeting: row.meetingTitle
        ? {
            title: row.meetingTitle,
            startsAt: (row.meetingStartsAt ?? row.createdAt).toISOString(),
            durationMinutes: row.meetingDuration ?? 30,
          }
        : undefined,
    }
  }

  private mapReactions(row: MessageRow): Reaction[] {
    const grouped = new Map<string, string[]>()
    for (const reaction of row.reactions) {
      grouped.set(reaction.emoji, [
        ...(grouped.get(reaction.emoji) ?? []),
        reaction.userId,
      ])
    }
    return Array.from(grouped, ([emoji, memberIds]) => ({ emoji, memberIds }))
  }

  private mapTeam(row: TeamRow): Team {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      channelIds: row.conversations.map((conversation) => conversation.id),
    }
  }

  async list(ctx: RequestContext): Promise<MessagingData> {
    const [conversations, messages, teams, onlineUsers] = await Promise.all([
      this.repo.listConversations(ctx.organizationId),
      this.repo.listMessages(ctx.organizationId),
      this.repo.listTeams(ctx.organizationId),
      prisma.member.findMany({
        where: { organizationId: ctx.organizationId, clientId: null },
        select: { userId: true, user: { select: { lastSeenAt: true } } },
      }),
    ])
    const now = Date.now()
    const presence: Record<string, Presence> = {}
    for (const entry of onlineUsers) {
      const lastSeen = entry.user.lastSeenAt?.getTime()
      if (!lastSeen) continue
      const minutes = (now - lastSeen) / 60000
      presence[entry.userId] =
        minutes < 2 ? "online" : minutes < 15 ? "away" : "offline"
    }
    const typing: Record<string, string[]> = {}
    return {
      teams: teams.map((team) => this.mapTeam(team)),
      conversations: conversations.map((conversation) =>
        this.mapConversation(conversation)
      ),
      messages: messages.map((message) => this.mapMessage(message)),
      presence,
      typing,
    }
  }

  async listConversations(ctx: RequestContext): Promise<Conversation[]> {
    const rows = await this.repo.listConversations(ctx.organizationId)
    return rows.map((row) => this.mapConversation(row))
  }

  async messagesFor(
    ctx: RequestContext,
    conversationId: string
  ): Promise<Message[]> {
    const conversation = await this.repo.findConversation(
      ctx.organizationId,
      conversationId
    )
    if (!conversation) throw new NotFoundError("Conversation")
    const messages = await this.repo.listMessages(ctx.organizationId)
    return messages
      .filter(
        (message) =>
          message.conversationId === conversationId && !message.parentId
      )
      .map((message) => this.mapMessage(message))
  }

  async sendMessage(
    ctx: RequestContext,
    input: SendMessageInput
  ): Promise<Message> {
    canWrite(ctx)
    const conversation = await this.repo.findConversation(
      ctx.organizationId,
      input.conversationId
    )
    if (!conversation) throw new NotFoundError("Conversation")

    const row = await this.repo.createMessage({
      conversationId: input.conversationId,
      authorId: ctx.userId,
      body: input.body,
      parentId: input.parentId,
      meetingTitle: input.meeting?.title,
      meetingStartsAt: input.meeting
        ? new Date(input.meeting.startsAt)
        : undefined,
      meetingDuration: input.meeting?.durationMinutes,
      attachments: input.attachments?.map((attachment) => ({
        name: attachment.name,
        kind: attachment.kind,
        meta: attachment.meta,
        oid: attachment.oid,
        mimeType: attachment.mimeType,
        sha256: attachment.sha256,
        sizeBytes: attachment.sizeBytes,
      })),
    })
    if (!input.parentId) {
      await this.repo.updateConversation(input.conversationId, {
        lastMessageAt: new Date(),
        unreadCount: 0,
      })
    }
    const message = this.mapMessage(row)
    return message
  }

  async editMessage(
    ctx: RequestContext,
    id: string,
    input: EditMessageInput
  ): Promise<Message> {
    canWrite(ctx)
    const existing = await this.repo.findMessage(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Message")
    assertAuthor(ctx, existing.authorId)
    const row = await this.repo.updateMessage(id, {
      body: input.body,
      edited: true,
    })
    const message = this.mapMessage(row)
    return message
  }

  async deleteMessage(
    ctx: RequestContext,
    id: string
  ): Promise<{ id: string }> {
    canWrite(ctx)
    const existing = await this.repo.findMessage(ctx.organizationId, id)
    if (!existing) throw new NotFoundError("Message")
    assertAuthor(ctx, existing.authorId)
    const oids = existing.attachments
      .map((attachment) => attachment.oid)
      .filter((oid): oid is bigint => oid !== null)
    await this.repo.deleteMessage(id)
    await Promise.all(
      oids.map((oid) =>
        unlinkLargeObject(Number(oid)).catch((error) =>
          console.error(
            `[messaging] failed to unlink large object ${oid}`,
            error
          )
        )
      )
    )
    return { id }
  }

  async toggleReaction(
    ctx: RequestContext,
    messageId: string,
    input: ToggleReactionInput
  ): Promise<Message> {
    canWrite(ctx)
    const existing = await this.repo.findMessage(ctx.organizationId, messageId)
    if (!existing) throw new NotFoundError("Message")
    await this.repo.toggleReaction(
      messageId,
      input.emoji,
      input.memberId ?? ctx.userId
    )
    const row = await this.repo.findMessage(ctx.organizationId, messageId)
    return this.mapMessage(row ?? existing)
  }

  async addThreadReply(
    ctx: RequestContext,
    input: AddThreadReplyInput
  ): Promise<Message> {
    canWrite(ctx)
    const parent = await this.repo.findMessage(
      ctx.organizationId,
      input.parentId
    )
    if (!parent) throw new NotFoundError("Message")
    const row = await this.repo.createMessage({
      conversationId: parent.conversationId,
      authorId: ctx.userId,
      body: input.body,
      parentId: parent.id,
    })
    return this.mapMessage(row)
  }

  async markRead(
    ctx: RequestContext,
    conversationId: string
  ): Promise<Conversation | null> {
    const conversation = await this.repo.findConversation(
      ctx.organizationId,
      conversationId
    )
    if (!conversation) return null
    if (conversation.unreadCount === 0)
      return this.mapConversation(conversation)
    const row = await this.repo.updateConversation(conversationId, {
      unreadCount: 0,
    })
    return this.mapConversation(row)
  }

  async startDirectMessage(
    ctx: RequestContext,
    input: StartDmInput
  ): Promise<Conversation> {
    canWrite(ctx)
    const existing = await this.repo.findDm(
      ctx.organizationId,
      ctx.userId,
      input.memberId
    )
    if (existing) return this.mapConversation(existing)

    const member = await prisma.member.findFirst({
      where: { organizationId: ctx.organizationId, userId: input.memberId },
      select: { user: { select: { name: true } } },
    })
    const name = member?.user.name ?? ctx.userName
    const row = await this.repo.createConversation({
      organizationId: ctx.organizationId,
      kind: "dm",
      name,
      memberIds: [ctx.userId, input.memberId],
    })
    return this.mapConversation(row)
  }

  async createChannel(
    ctx: RequestContext,
    input: CreateChannelInput
  ): Promise<Conversation> {
    canWrite(ctx)
    const team = await this.repo.findTeam(ctx.organizationId, input.teamId)
    if (!team) throw new NotFoundError("Team")
    const row = await this.repo.createConversation({
      organizationId: ctx.organizationId,
      kind: "channel",
      name: input.name,
      teamId: input.teamId,
      topic: input.topic,
      memberIds: [ctx.userId],
    })
    return this.mapConversation(row)
  }

  async toggleMute(
    ctx: RequestContext,
    conversationId: string,
    muted?: boolean
  ): Promise<Conversation> {
    canWrite(ctx)
    const existing = await this.repo.findConversation(
      ctx.organizationId,
      conversationId
    )
    if (!existing) throw new NotFoundError("Conversation")
    const row = await this.repo.updateConversation(conversationId, {
      muted: muted ?? !existing.muted,
    })
    return this.mapConversation(row)
  }

  async togglePin(
    ctx: RequestContext,
    conversationId: string,
    pinned?: boolean
  ): Promise<Conversation> {
    canWrite(ctx)
    const existing = await this.repo.findConversation(
      ctx.organizationId,
      conversationId
    )
    if (!existing) throw new NotFoundError("Conversation")
    const row = await this.repo.updateConversation(conversationId, {
      pinned: pinned ?? !existing.pinned,
    })
    return this.mapConversation(row)
  }

  async listTeams(ctx: RequestContext): Promise<Team[]> {
    const rows = await this.repo.listTeams(ctx.organizationId)
    return rows.map((row) => this.mapTeam(row))
  }

  setTyping(
    ctx: RequestContext,
    conversationId: string,
    input: SetTypingInput
  ): { ok: true } {
    return { ok: true }
  }

  async touchPresence(ctx: RequestContext): Promise<void> {
    await prisma.user.update({
      where: { id: ctx.userId },
      data: { lastSeenAt: new Date() },
    })
  }
}

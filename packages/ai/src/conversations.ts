import type { AgentInputItem } from "@openai/agents"

import { prisma } from "@workspace/db"
import type { RequestContext } from "@workspace/core"

import {
  toAgentInput,
  type AssistantPart,
  type ChatMessage,
  type ConversationSummary,
} from "./chat"

type MessageRow = {
  id: string
  role: string
  parts: unknown
  createdAt: Date
}

function toParts(value: unknown): AssistantPart[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (part): part is AssistantPart =>
      !!part &&
      typeof part === "object" &&
      "type" in part &&
      (part.type === "text" ||
        part.type === "reasoning" ||
        part.type === "tool")
  )
}

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role === "user" ? "user" : "assistant",
    parts: toParts(row.parts),
  }
}

export function titleFromText(text: string): string {
  const value = text.trim().replace(/\s+/g, " ")
  if (value.length <= 80) return value
  return `${value.slice(0, 77)}…`
}

export async function listConversations(
  ctx: RequestContext,
  limit = 40
): Promise<ConversationSummary[]> {
  const rows = await prisma.assistantConversation.findMany({
    where: { organizationId: ctx.organizationId, userId: ctx.userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true, updatedAt: true },
  })
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }))
}

export async function getConversation(
  ctx: RequestContext,
  conversationId: string
): Promise<{ conversation: ConversationSummary; messages: ChatMessage[] } | null> {
  const conversation = await prisma.assistantConversation.findFirst({
    where: {
      id: conversationId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!conversation) return null

  return {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: conversation.messages.map(toChatMessage),
  }
}

export async function createConversation(
  ctx: RequestContext,
  title: string
): Promise<ConversationSummary> {
  const conversation = await prisma.assistantConversation.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      title,
    },
    select: { id: true, title: true, updatedAt: true },
  })
  return {
    id: conversation.id,
    title: conversation.title,
    updatedAt: conversation.updatedAt.toISOString(),
  }
}

export async function appendMessage(
  ctx: RequestContext,
  conversationId: string,
  role: "user" | "assistant",
  parts: AssistantPart[]
): Promise<ChatMessage> {
  const owned = await prisma.assistantConversation.findFirst({
    where: {
      id: conversationId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    },
    select: { id: true },
  })
  if (!owned) throw new Error("Conversation not found")

  const [message] = await prisma.$transaction([
    prisma.assistantMessage.create({
      data: {
        conversationId,
        role,
        parts: JSON.parse(JSON.stringify(parts)),
      },
      select: { id: true, role: true, parts: true, createdAt: true },
    }),
    prisma.assistantConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ])

  return toChatMessage(message)
}

export async function deleteConversation(
  ctx: RequestContext,
  conversationId: string
): Promise<void> {
  await prisma.assistantConversation.deleteMany({
    where: {
      id: conversationId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
    },
  })
}

/**
 * Rebuild the Agents SDK input from stored messages. The client never supplies
 * history, so tool calls cannot be forged or replayed (ADR 0022).
 */
export async function conversationInput(
  ctx: RequestContext,
  conversationId: string
): Promise<{ conversation: ConversationSummary; input: AgentInputItem[] } | null> {
  const found = await getConversation(ctx, conversationId)
  if (!found) return null
  return {
    conversation: found.conversation,
    input: toAgentInput(found.messages),
  }
}

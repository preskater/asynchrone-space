import { getRequestContext } from "@/lib/core/auth-context"
import { readJson } from "@/lib/core/validation"

import { messagingService } from "./index"
import {
  addThreadReplySchema,
  createChannelSchema,
  editMessageSchema,
  muteSchema,
  pinSchema,
  sendMessageSchema,
  setTypingSchema,
  startDmSchema,
  toggleReactionSchema,
} from "./schemas"

export async function listMessaging(request: Request) {
  const ctx = await getRequestContext({ request })
  return messagingService.list(ctx)
}

export async function sendMessage(request: Request) {
  const ctx = await getRequestContext({ request })
  const input = sendMessageSchema.parse(await readJson(request))
  return messagingService.sendMessage(ctx, input)
}

export async function editMessage(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { messageId } = await params
  const input = editMessageSchema.parse(await readJson(request))
  return messagingService.editMessage(ctx, messageId, input)
}

export async function deleteMessage(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { messageId } = await params
  return messagingService.deleteMessage(ctx, messageId)
}

export async function toggleReaction(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { messageId } = await params
  const input = toggleReactionSchema.parse(await readJson(request))
  return messagingService.toggleReaction(ctx, messageId, input)
}

export async function listThreadReplies(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { messageId } = await params
  return messagingService.listThreadReplies(ctx, messageId)
}

export async function addThreadReply(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { messageId } = await params
  const input = addThreadReplySchema.parse({
    ...((await readJson(request)) as Record<string, unknown>),
    parentId: messageId,
  })
  return messagingService.addThreadReply(ctx, input)
}

export async function markRead(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { conversationId } = await params
  return messagingService.markRead(ctx, conversationId)
}

export async function startDm(request: Request) {
  const ctx = await getRequestContext({ request })
  const input = startDmSchema.parse(await readJson(request))
  return messagingService.startDirectMessage(ctx, input)
}

export async function createChannel(request: Request) {
  const ctx = await getRequestContext({ request })
  const input = createChannelSchema.parse(await readJson(request))
  return messagingService.createChannel(ctx, input)
}

export async function setTyping(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { conversationId } = await params
  const input = setTypingSchema.parse(await readJson(request))
  return messagingService.setTyping(ctx, conversationId, input)
}

export async function toggleMute(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { conversationId } = await params
  const input = muteSchema.parse(await readJson(request))
  return messagingService.toggleMute(ctx, conversationId, input.muted)
}

export async function togglePin(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { conversationId } = await params
  const input = pinSchema.parse(await readJson(request))
  return messagingService.togglePin(ctx, conversationId, input.pinned)
}

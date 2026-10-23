import { run, type AgentInputItem, type RunStreamEvent } from "@openai/agents"
import { z } from "zod"

import {
  appendMessage,
  assistantAgent,
  conversationInput,
  createConversation,
  titleFromText,
} from "@workspace/ai/server"
import type { AssistantPart } from "@workspace/ai/chat"
import { getRequestContext } from "@workspace/auth/server"
import { rateLimit } from "@workspace/core/server"

export const runtime = "nodejs"
export const maxDuration = 60

const MAX_TURNS = 8
const MAX_TEXT_LENGTH = 8_000
const STREAM_ERROR_MESSAGE =
  "The assistant could not complete your request. Please try again."

const bodySchema = z.object({
  conversationId: z.string().min(1).optional(),
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
})

type AssistantEvent =
  | { type: "meta"; conversationId: string }
  | { type: "text"; delta: string }
  | { type: "reasoning"; text: string }
  | { type: "tool_call"; name: string; callId: string; args: string }
  | { type: "tool_output"; name: string; callId: string; output: string }
  | { type: "error"; message: string }
  | { type: "done" }

function toOutputString(output: unknown): string {
  if (typeof output === "string") return output
  try {
    return JSON.stringify(output)
  } catch {
    return String(output)
  }
}

function toClientEvent(event: RunStreamEvent): AssistantEvent | undefined {
  if (event.type === "raw_model_stream_event") {
    if (event.data.type === "output_text_delta") {
      return { type: "text", delta: event.data.delta }
    }
    return undefined
  }

  if (event.type !== "run_item_stream_event") return undefined

  if (event.name === "tool_called") {
    const raw = event.item.rawItem
    if (raw.type !== "function_call") return undefined
    return {
      type: "tool_call",
      name: raw.name,
      callId: raw.callId,
      args: raw.arguments,
    }
  }

  if (event.name === "tool_output") {
    const item = event.item
    if (item.type !== "tool_call_output_item") return undefined
    const raw = item.rawItem
    if (!("name" in raw) || !("callId" in raw)) return undefined
    return {
      type: "tool_output",
      name: raw.name,
      callId: raw.callId,
      output: toOutputString(item.output),
    }
  }

  if (event.name === "reasoning_item_created") {
    const raw = event.item.rawItem
    if (raw.type !== "reasoning") return undefined
    const text = raw.content
      .map((part) => (part.type === "input_text" ? part.text : ""))
      .join("")
    if (!text) return undefined
    return { type: "reasoning", text }
  }

  return undefined
}

function appendTextPart(parts: AssistantPart[], delta: string) {
  const last = parts[parts.length - 1]
  if (last && last.type === "text") {
    last.text += delta
  } else {
    parts.push({ type: "text", text: delta })
  }
}

export async function POST(request: Request) {
  const ctx = await getRequestContext()

  if (!rateLimit(`assistant:${ctx.userId}`, 20, 5 * 60_000)) {
    return new Response("Too many requests", { status: 429 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return new Response("Invalid request", { status: 422 })
  }

  let conversationId = parsed.data.conversationId
  let input: AgentInputItem[] = []

  if (conversationId) {
    const existing = await conversationInput(ctx, conversationId)
    if (!existing) return new Response("Not found", { status: 404 })
    input = existing.input
  } else {
    const conversation = await createConversation(
      ctx,
      titleFromText(parsed.data.text)
    )
    conversationId = conversation.id
  }

  const userMessage = await appendMessage(ctx, conversationId, "user", [
    { type: "text", text: parsed.data.text },
  ])
  input = [...input, { role: "user", content: parsed.data.text }]

  const parts: AssistantPart[] = []
  const stream = await run(assistantAgent, input, {
    stream: true,
    context: ctx,
    maxTurns: MAX_TURNS,
  })

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AssistantEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      send({ type: "meta", conversationId: conversationId! })
      void userMessage

      try {
        for await (const event of stream) {
          const clientEvent = toClientEvent(event)
          if (!clientEvent) continue

          if (clientEvent.type === "text") {
            appendTextPart(parts, clientEvent.delta)
          } else if (clientEvent.type === "reasoning") {
            parts.push({
              type: "reasoning",
              text: clientEvent.text,
              state: "done",
            })
          } else if (clientEvent.type === "tool_call") {
            parts.push({
              type: "tool",
              name: clientEvent.name,
              callId: clientEvent.callId,
              args: clientEvent.args,
              state: "call",
            })
          } else if (clientEvent.type === "tool_output") {
            const tool = parts.find(
              (part) =>
                part.type === "tool" && part.callId === clientEvent.callId
            )
            if (tool && tool.type === "tool") {
              tool.state = "output"
              tool.output = clientEvent.output
            }
          }

          send(clientEvent)
        }
        await stream.completed
        if (parts.length > 0) {
          await appendMessage(ctx, conversationId!, "assistant", parts)
        }
        send({ type: "done" })
      } catch (error) {
        console.error("[assistant] stream error", error)
        if (parts.length > 0) {
          await appendMessage(ctx, conversationId!, "assistant", parts).catch(
            () => {}
          )
        }
        send({ type: "error", message: STREAM_ERROR_MESSAGE })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}

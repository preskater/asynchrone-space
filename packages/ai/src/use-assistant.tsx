"use client"

import * as React from "react"

import type { AssistantPart, ChatMessage } from "./chat"

export type AssistantStatus = "ready" | "submitted" | "streaming" | "error"

interface AssistantEvent {
  type:
    | "meta"
    | "text"
    | "reasoning"
    | "tool_call"
    | "tool_output"
    | "error"
    | "done"
  conversationId?: string
  delta?: string
  text?: string
  name?: string
  callId?: string
  args?: string
  output?: string
  message?: string
}

interface AssistantStore {
  messages: ChatMessage[]
  sendMessage: (input: { text: string }) => Promise<void>
  status: AssistantStatus
  error: Error | null
  conversationId: string | undefined
}

const AssistantContext = React.createContext<AssistantStore | null>(null)

export function AssistantProvider({
  children,
  initialMessages = [],
  initialConversationId,
  onConversationCreated,
  onComplete,
}: {
  children: React.ReactNode
  initialMessages?: ChatMessage[]
  initialConversationId?: string
  onConversationCreated?: (conversationId: string) => void
  onComplete?: (conversationId: string | undefined) => void
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages)
  const [status, setStatus] = React.useState<AssistantStatus>("ready")
  const [error, setError] = React.useState<Error | null>(null)
  const [conversationId, setConversationId] = React.useState<
    string | undefined
  >(initialConversationId)

  const conversationRef = React.useRef(conversationId)
  conversationRef.current = conversationId
  const messagesRef = React.useRef(messages)
  messagesRef.current = messages

  const sendMessage = React.useCallback(async ({ text }: { text: string }) => {
    const value = text.trim()
    if (!value) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      parts: [{ type: "text", text: value }],
    }
    const assistantId = crypto.randomUUID()

    setError(null)
    setStatus("submitted")
    setMessages((prev) => {
      const next: ChatMessage[] = [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", parts: [] },
      ]
      messagesRef.current = next
      return next
    })

    const updateAssistant = (
      mutate: (parts: AssistantPart[]) => AssistantPart[]
    ) => {
      setMessages((prev) => {
        const next = prev.map((message) =>
          message.id === assistantId
            ? { ...message, parts: mutate(message.parts) }
            : message
        )
        messagesRef.current = next
        return next
      })
    }

    const handle = (event: AssistantEvent) => {
      if (event.type === "meta") {
        if (event.conversationId) {
          conversationRef.current = event.conversationId
          setConversationId(event.conversationId)
          onConversationCreated?.(event.conversationId)
        }
        return
      }
      if (event.type === "text") {
        const delta = event.delta ?? ""
        updateAssistant((parts) => {
          const last = parts[parts.length - 1]
          if (last && last.type === "text") {
            return [...parts.slice(0, -1), { ...last, text: last.text + delta }]
          }
          return [...parts, { type: "text", text: delta }]
        })
      } else if (event.type === "reasoning") {
        const text = event.text ?? ""
        updateAssistant((parts) => {
          const last = parts[parts.length - 1]
          if (last && last.type === "reasoning" && last.state === "streaming") {
            return [...parts.slice(0, -1), { ...last, text: last.text + text }]
          }
          return [...parts, { type: "reasoning", text, state: "streaming" }]
        })
      } else if (event.type === "tool_call") {
        updateAssistant((parts) => [
          ...parts,
          {
            type: "tool",
            name: event.name ?? "tool",
            callId: event.callId ?? "",
            args: event.args ?? "",
            state: "call",
          },
        ])
      } else if (event.type === "tool_output") {
        updateAssistant((parts) =>
          parts.map((part) =>
            part.type === "tool" && part.callId === event.callId
              ? { ...part, state: "output", output: event.output }
              : part
          )
        )
      } else if (event.type === "error") {
        throw new Error(event.message ?? "The assistant failed.")
      }
    }

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversationRef.current,
          text: value,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status})`)
      }

      setStatus("streaming")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      for (;;) {
        const { done, value: chunk } = await reader.read()
        if (done) break
        buffer += decoder.decode(chunk, { stream: true })
        let newlineIndex = buffer.indexOf("\n")
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim()
          buffer = buffer.slice(newlineIndex + 1)
          if (line) handle(JSON.parse(line) as AssistantEvent)
          newlineIndex = buffer.indexOf("\n")
        }
      }

      updateAssistant((parts) =>
        parts.map((part) =>
          part.type === "reasoning" && part.state === "streaming"
            ? { ...part, state: "done" }
            : part
        )
      )
      setStatus("ready")
      onComplete?.(conversationRef.current)
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
      setStatus("error")
    }
  }, [onComplete, onConversationCreated])

  const store = React.useMemo<AssistantStore>(
    () => ({ messages, sendMessage, status, error, conversationId }),
    [messages, sendMessage, status, error, conversationId]
  )

  return (
    <AssistantContext.Provider value={store}>
      {children}
    </AssistantContext.Provider>
  )
}

export function useAssistant() {
  const context = React.useContext(AssistantContext)
  if (!context) {
    throw new Error("useAssistant must be used within an AssistantProvider")
  }
  return context
}

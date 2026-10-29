import "./provider"

import { Agent } from "@openai/agents"

import type { RequestContext } from "@/lib/core/context"
import { assistantTools } from "@/lib/assistant/tools"

export const INSTRUCTIONS = `You are the Asynchrone Space assistant, embedded in an AI-native productivity workspace.
You can read and modify the user's projects, tasks, calendars, files and messages through tools.
Prefer calling a read tool before making changes. Keep replies concise and action-oriented.
When you create or change something, confirm briefly what you did.
Always finish with a short, self-contained text answer that summarizes the result for the user.`

export const assistantAgent = new Agent<RequestContext>({
  name: "Asynchrone Space Assistant",
  instructions: INSTRUCTIONS,
  tools: assistantTools,
  ...(process.env.ASSISTANT_MODEL
    ? { model: process.env.ASSISTANT_MODEL }
    : {}),
})

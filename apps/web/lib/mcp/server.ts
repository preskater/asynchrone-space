import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { calendarTools } from "./tools/calendars"
import { fileTools } from "./tools/files"
import { hrTools } from "./tools/hr"
import { messagingTools } from "./tools/messaging"
import { projectTools } from "./tools/projects"
import type { McpTool } from "./tools/projects"
import { contextFromAuthInfo } from "./context"

export const allMcpTools: McpTool[] = [
  ...projectTools,
  ...calendarTools,
  ...hrTools,
  ...fileTools,
  ...messagingTools,
]

function textResult(value: unknown) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(value, null, 2) },
    ],
    structuredContent: { data: value },
  }
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error"
  return {
    isError: true,
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  }
}

export function registerTools(server: McpServer) {
  for (const tool of allMcpTools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: !tool.readOnly,
          idempotentHint: tool.readOnly,
        },
      },
      async (args, extra) => {
        try {
          const ctx = contextFromAuthInfo(extra.authInfo)
          const result = await tool.run(
            ctx,
            (args ?? {}) as Record<string, unknown>
          )
          return textResult(result)
        } catch (error) {
          return errorResult(error)
        }
      }
    )
  }
}

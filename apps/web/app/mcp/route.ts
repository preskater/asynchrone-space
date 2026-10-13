import { createMcpHandler, withMcpAuth } from "mcp-handler"
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseRoles } from "@/lib/organization/utils"
import { registerTools } from "@/lib/mcp/server"

export const runtime = "nodejs"
export const maxDuration = 60

function fromServiceToken(token: string): AuthInfo | undefined {
  const expected = process.env.MCP_SERVICE_TOKEN
  if (!expected || token !== expected) return undefined
  const organizationId = process.env.MCP_SERVICE_ORG_ID
  const userId = process.env.MCP_SERVICE_USER_ID
  if (!organizationId || !userId) return undefined
  return {
    token,
    clientId: "presk-service",
    scopes: ["projects", "calendars", "files", "messaging", "hr"],
    extra: {
      userId,
      organizationId,
      role: process.env.MCP_SERVICE_ROLE ?? "member",
      userName: process.env.MCP_SERVICE_USER_NAME ?? "Presk Assistant",
      userEmail: process.env.MCP_SERVICE_USER_EMAIL ?? "assistant@presk.app",
    },
  }
}

async function fromSession(request: Request): Promise<AuthInfo | undefined> {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return undefined
  const organizationId = session.session.activeOrganizationId
  if (!organizationId) return undefined

  const member = await prisma.member.findFirst({
    where: { organizationId, userId: session.user.id },
    select: { role: true },
  })

  return {
    token: session.session.token,
    clientId: session.user.id,
    scopes: ["projects", "calendars", "files", "messaging", "hr"],
    extra: {
      userId: session.user.id,
      organizationId,
      role: parseRoles(member?.role)[0] ?? "member",
      userName: session.user.name,
      userEmail: session.user.email,
    },
  }
}

async function verifyToken(
  request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (bearerToken) {
    const fromToken = fromServiceToken(bearerToken)
    if (fromToken) return fromToken
  }
  return fromSession(request)
}

const handler = createMcpHandler(
  (server) => {
    registerTools(server)
  },
  {
    serverInfo: { name: "presk-mcp", version: "0.1.0" },
  },
  {
    basePath: "",
    disableSse: true,
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV !== "production",
  }
)

const authed = withMcpAuth(handler, verifyToken, { required: true })

export { authed as GET, authed as POST, authed as DELETE }

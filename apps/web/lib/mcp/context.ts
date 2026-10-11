import type { AuthInfo } from "@modelcontextprotocol/server"

import { UnauthorizedError } from "@/lib/core/errors"
import type { RequestContext } from "@/lib/core/context"
import type { OrgRole } from "@/lib/organization/roles"

type Claims = Record<string, unknown>

function stringClaim(claims: Claims, key: string): string | undefined {
  const value = claims[key]
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/**
 * Convert the verified OAuth access-token claims issued by the MCP plugin into
 * the SDK's {@link AuthInfo}. Custom claims (`organizationId`, `role`,
 * `userName`, `userEmail`) are attached by `customAccessTokenClaims` in
 * `lib/auth.ts` when the user authorizes a client.
 */
export function authInfoFromClaims(claims: Claims): AuthInfo {
  const scope = stringClaim(claims, "scope")
  return {
    token: stringClaim(claims, "jti") ?? "access-token",
    clientId:
      stringClaim(claims, "client_id") ??
      stringClaim(claims, "azp") ??
      "mcp-client",
    scopes: scope ? scope.split(" ").filter(Boolean) : [],
    extra: {
      userId: stringClaim(claims, "sub"),
      organizationId: stringClaim(claims, "organizationId"),
      role: stringClaim(claims, "role"),
      userName: stringClaim(claims, "userName"),
      userEmail: stringClaim(claims, "userEmail"),
    },
  }
}

interface McpTokenExtra {
  userId?: string
  organizationId?: string
  role?: OrgRole
  userName?: string
  userEmail?: string
}

export function contextFromAuthInfo(
  authInfo: AuthInfo | undefined
): RequestContext {
  const extra = (authInfo?.extra ?? {}) as McpTokenExtra
  if (!extra.userId || !extra.organizationId) {
    throw new UnauthorizedError(
      "The MCP access token is missing a workspace context."
    )
  }
  return {
    userId: extra.userId,
    organizationId: extra.organizationId,
    role: extra.role ?? "member",
    userName: extra.userName ?? "Presk Assistant",
    userEmail: extra.userEmail ?? "assistant@presk.app",
  }
}

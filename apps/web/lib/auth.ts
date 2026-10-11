import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { admin, jwt, organization } from "better-auth/plugins"

import { ac, orgRoles } from "./organization/access"
import { parseRoles } from "./organization/utils"
import { prisma } from "./prisma"

const mcpResource =
  process.env.MCP_RESOURCE_URL || `${process.env.BETTER_AUTH_URL}/mcp`

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Dynamic Client Registration defaults an omitted `application_type`
      // to `web`, which rejects the loopback `http://127.0.0.1` callback that
      // native MCP clients such as opencode use. Default it to `native`.
      if (ctx.path !== "/oauth2/register") return
      const body = ctx.body as { application_type?: string } | undefined
      if (body && body.application_type === undefined) {
        body.application_type = "native"
      }
    }),
  },
  plugins: [
    organization({
      teams: { enabled: true },
      ac,
      roles: orgRoles,
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 100,
      creatorRole: "owner",
      requireEmailVerificationOnInvitation: false,
      organizationHooks: {
        afterCreateOrganization: async ({ organization, user }) => {
          await prisma.calendar.create({
            data: {
              organizationId: organization.id,
              name: "Personal",
              kind: "personal",
              color: "blue",
              members: { create: [{ userId: user.id }] },
            },
          })
        },
      },
    }),
    admin(),
    jwt(),
    mcp({
      loginPage: "/sign-in",
      consentPage: "/consent",
      resource: mcpResource,
      // CIMD is the primary client-identity mechanism; DCR stays enabled as a
      // fallback for MCP clients that predate Client ID Metadata Documents
      // (e.g. opencode), which self-register over RFC 7591. See the register
      // hook above for the `application_type` default.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      resources: [
        {
          identifier: mcpResource,
          allowedScopes: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "projects",
            "calendars",
            "files",
            "messaging",
          ],
        },
      ],
      scopes: [
        "openid",
        "profile",
        "email",
        "offline_access",
        "projects",
        "calendars",
        "files",
        "messaging",
      ],
      postLogin: {
        page: "/select-organization",
        consentReferenceId: ({ session }) =>
          (session.activeOrganizationId as string | undefined) ?? undefined,
        shouldRedirect: ({ session }) => !session.activeOrganizationId,
      },
      customAccessTokenClaims: async ({ user, referenceId }) => {
        if (!user || !referenceId) return {}
        const member = await prisma.member.findFirst({
          where: { organizationId: referenceId, userId: user.id },
          select: { role: true },
        })
        return {
          organizationId: referenceId,
          role: parseRoles(member?.role)[0] ?? "member",
          userName: user.name,
          userEmail: user.email,
        }
      },
    }),
    cimd({
      fetchClientMetadataResource,
      metadataProfile: "mcp-2026-07-28",
    }),
    nextCookies(),
  ],
})

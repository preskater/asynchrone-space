import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { createAuthMiddleware } from "better-auth/api"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { admin, jwt, organization } from "better-auth/plugins"
import {
  adminAc,
  defaultAc,
  userAc,
} from "better-auth/plugins/admin/access"

import { sendResetPasswordEmail, sendVerificationEmail } from "./email"
import { ac, orgRoles } from "./organization/access"
import { parseRoles } from "./organization/utils"
import { prisma } from "./prisma"

const mcpResource =
  process.env.MCP_RESOURCE_URL || `${process.env.BETTER_AUTH_URL}/mcp`

/**
 * GitHub/GitLab OAuth apps power optional account linking: a linked account
 * is an alternative repository credential to the personal access token a
 * user saves in their profile (see lib/integrations). The token is stored on
 * the `account` row by Better Auth.
 */
function oauthApp(
  clientId: string | undefined,
  clientSecret: string | undefined,
  scope: string[]
) {
  return clientId && clientSecret ? { clientId, clientSecret, scope } : undefined
}

const githubOauth = oauthApp(
  process.env.GITHUB_CLIENT_ID,
  process.env.GITHUB_CLIENT_SECRET,
  ["user:email", "repo"]
)
const gitlabOauth = oauthApp(
  process.env.GITLAB_CLIENT_ID,
  process.env.GITLAB_CLIENT_SECRET,
  ["read_user", "api"]
)

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // Flipped on at GA; `lib/env.ts` refuses to boot if it is enabled without
    // an email provider, which would otherwise lock every new user out.
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === "true",
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      sendResetPasswordEmail({ to: user.email, url })
    },
    onPasswordReset: async ({ user }) => {
      console.info(`[auth] password reset completed for user ${user.id}`)
    },
  },
  emailVerification: {
    // Existing accounts (created before the flag was enabled) are unverified
    // too, so an unverified sign-in attempt sends them a fresh link.
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendVerificationEmail({ to: user.email, url })
    },
  },
  socialProviders: {
    ...(githubOauth ? { github: githubOauth } : {}),
    ...(gitlabOauth ? { gitlab: gitlabOauth } : {}),
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
    // Platform administration lives in `apps/control-tower`, but the plugin
    // must be registered here too so bans and role checks apply to customer
    // sign-in and so the impersonation handoff can create a session.
    admin({
      adminRoles: ["platform_admin"],
      defaultRole: "user",
      roles: {
        platform_admin: adminAc,
        platform_support: defaultAc.newRole({
          user: ["list", "get"],
          session: ["list"],
        }),
        user: userAc,
      },
    }),
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

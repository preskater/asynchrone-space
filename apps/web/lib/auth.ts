import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import {
  admin,
  captcha,
  haveIBeenPwned,
  jwt,
  organization,
  twoFactor,
} from "better-auth/plugins"
import { adminAc, defaultAc, userAc } from "better-auth/plugins/admin/access"

import { MIN_PASSWORD_LENGTH } from "./account/password-policy"
import { recordSessionRevocation } from "./account/session-audit"
import { recordTwoFactorChange } from "./account/two-factor-audit"
import { rateLimit } from "./core/rate-limit"
import { parseTrustedIpHeaders } from "./core/trusted-ip"
import { sendResetPasswordEmail, sendVerificationEmail } from "./email"
import { ac, orgRoles } from "./organization/access"
import { seatsFull } from "./organization/entitlements"
import { parseRoles } from "./organization/utils"
import { prisma } from "./prisma"
import { isBlockedEmailDomain, isInviteOnly } from "./signup-policy"

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
  return clientId && clientSecret
    ? { clientId, clientSecret, scope }
    : undefined
}

/** Rejects a new workspace seat once the plan's limit is reached. */
async function assertSeatAvailable(
  organizationId: string,
  role: string | null | undefined,
  countPending: boolean
) {
  // Client-portal accounts never take a seat.
  if (parseRoles(role).includes("client")) return
  const { full, seats } = await seatsFull(organizationId, { countPending })
  if (full) {
    throw new APIError("FORBIDDEN", {
      code: "UPGRADE_REQUIRED",
      message: `Your plan includes up to ${seats} members. Upgrade to add more.`,
    })
  }
}

/** Caps invitation emails per organization; fails closed since each one sends mail. */
async function assertInvitationRate(organizationId: string) {
  const { allowed, retryAfter } = await rateLimit(
    `invitations:${organizationId}`,
    50,
    60 * 60_000,
    { failOpen: false }
  )
  if (!allowed) {
    throw new APIError(
      "TOO_MANY_REQUESTS",
      { message: "Too many invitations. Try again later." },
      { "Retry-After": String(retryAfter) }
    )
  }
}

/** Rejects throwaway addresses and, in invite-only mode, uninvited ones. */
async function assertSignupAllowed(email: string) {
  if (isBlockedEmailDomain(email)) {
    throw new APIError("FORBIDDEN", {
      code: "EMAIL_DOMAIN_BLOCKED",
      message: "Sign-up with this email provider is not allowed.",
    })
  }
  if (!isInviteOnly()) return
  const invitation = await prisma.invitation.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  })
  if (!invitation) {
    throw new APIError("FORBIDDEN", {
      code: "INVITATION_REQUIRED",
      message: "Sign-up is by invitation only.",
    })
  }
}

const turnstileSecret = process.env.TURNSTILE_SECRET_KEY

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
    minPasswordLength: MIN_PASSWORD_LENGTH,
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
  // Shared across replicas through the `rateLimit` table. Better Auth only
  // enables it in production; dev keeps working without counters.
  rateLimit: {
    storage: "database",
    customRules: {
      "/sign-in/*": { window: 5 * 60, max: 10 },
      "/sign-up/*": { window: 60 * 60, max: 5 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/send-verification-email": { window: 60 * 60, max: 5 },
    },
  },
  advanced: {
    // Only headers a proxy overwrites are trusted. ingress-nginx sets X-Real-IP
    // to the client address and appends to X-Forwarded-For; behind anything
    // else (or exposed directly) a client could choose these values, so the
    // deployment must terminate at such a proxy. See TRUSTED_IP_HEADERS.
    ipAddress: {
      ipAddressHeaders: parseTrustedIpHeaders(process.env.TRUSTED_IP_HEADERS),
    },
  },
  databaseHooks: {
    user: {
      // Covers every sign-up path, OAuth included.
      create: {
        before: async (user) => {
          await assertSignupAllowed(user.email)
        },
      },
      update: {
        after: async (user, ctx) => {
          await recordTwoFactorChange(user.id, ctx?.path)
        },
      },
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
    after: createAuthMiddleware(async (ctx) => {
      const userId = ctx.context.session?.user.id
      if (!userId || ctx.context.returned instanceof APIError) return
      await recordSessionRevocation(userId, ctx.path)
    }),
  },
  plugins: [
    // Rejects breached passwords on sign-up, change and reset through the HIBP
    // k-anonymity range API: only the first 5 characters of the SHA-1 leave.
    // Fails closed: if the API is down, the request fails and can be retried.
    haveIBeenPwned(),
    organization({
      teams: { enabled: true },
      ac,
      roles: orgRoles,
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      // Seats are plan-aware and enforced by the hooks below, which exclude
      // client-portal accounts; this static limit is only a backstop.
      membershipLimit: 10_000,
      creatorRole: "owner",
      // Deletion goes through the 30-day grace period and the
      // organization-deletion cron, which also unlinks file large objects.
      disableOrganizationDeletion: true,
      requireEmailVerificationOnInvitation: false,
      organizationHooks: {
        beforeCreateInvitation: async ({ invitation }) => {
          await assertInvitationRate(invitation.organizationId)
          await assertSeatAvailable(
            invitation.organizationId,
            invitation.role,
            true
          )
        },
        // No seat check when accepting: the invitation reserved its seat when
        // it was created (pending ones are counted there), so lowering a plan
        // cap must not strand invitations that were legitimately issued.
        beforeAddMember: async ({ member }) => {
          await assertSeatAvailable(member.organizationId, member.role, false)
        },
        // A new role must not ride on sessions opened under the old one, so
        // the member signs in again everywhere.
        afterUpdateMemberRole: async ({ member, previousRole }) => {
          if (member.role === previousRole) return
          await prisma.session.deleteMany({ where: { userId: member.userId } })
        },
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
    // Customer TOTP. Mapped to its own table and user column: the control
    // tower's `twoFactor` rows are encrypted with a different secret (ADR 0018).
    twoFactor({
      issuer: "Asynchrone Space",
      trustDeviceMaxAge: 30 * 24 * 60 * 60,
      schema: {
        user: { fields: { twoFactorEnabled: "customerTwoFactorEnabled" } },
        twoFactor: { modelName: "customerTwoFactor" },
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
    // Enforced server-side on sign-up and password reset once configured;
    // the forms render the widget from TURNSTILE_SITE_KEY.
    ...(turnstileSecret
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: turnstileSecret,
            endpoints: ["/sign-up/email", "/request-password-reset"],
          }),
        ]
      : []),
    nextCookies(),
  ],
})

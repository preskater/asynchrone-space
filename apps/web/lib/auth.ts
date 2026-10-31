import { cimd } from "@better-auth/cimd"
import { fetchClientMetadataResource } from "@better-auth/cimd/node"
import { mcp } from "@better-auth/mcp"
import { betterAuth } from "better-auth"
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api"
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
import { parseTrustedIpHeaders } from "@workspace/core/trusted-ip"
import { recordAuthAuditEvent } from "./audit/auth-audit"
import { sendResetPasswordEmail, sendVerificationEmail } from "./email"
import { ac, orgRoles } from "./organization/access"
import {
  entitlementsFor,
  resolvePlan,
  seatsFull,
} from "./organization/entitlements"
import { parseRoles } from "./organization/utils"
import { prisma } from "./prisma"
import { isBlockedEmailDomain, isInviteOnly } from "./signup-policy"
import { buildOAuthClaims, twoFactorEnrollmentRequired } from "./oauth/claims"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  MCP_RESOURCE,
  REFRESH_TOKEN_REUSE_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  oauthResources,
  oauthScopes,
  trustedClientIds,
} from "./oauth/resources"
import {
  revokeOauthTokensForSession,
  revokeOauthTokensForUser,
} from "./oauth/revoke"

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
      // OAuth authorization must not issue a code to a member who still has to
      // enroll in 2FA under the organization policy. The redirect preserves the
      // authorize URL so the setup page can send the user back into the flow.
      if (ctx.path === "/oauth2/authorize") {
        const session = await getSessionFromCtx(ctx)
        if (session && !session.session.impersonatedBy) {
          const organizationId = session.session.activeOrganizationId
          if (organizationId) {
            const organization = await prisma.organization.findUnique({
              where: { id: organizationId },
              select: {
                requireTwoFactor: true,
                metadata: true,
                trialEndsAt: true,
                subscription: { select: { plan: true } },
              },
            })
            if (organization) {
              const plan = resolvePlan({
                metadata: organization.metadata,
                trialEndsAt: organization.trialEndsAt,
                subscription: organization.subscription ?? null,
              })
              const enrolled = Boolean(session.user.twoFactorEnabled)
              if (
                twoFactorEnrollmentRequired({
                  required: organization.requireTwoFactor,
                  entitled: entitlementsFor(plan).requireTwoFactor,
                  enrolled,
                  impersonated: false,
                })
              ) {
                const requestUrl = ctx.request?.url
                if (requestUrl) {
                  const next = encodeURIComponent(requestUrl)
                  throw ctx.redirect(
                    new URL(
                      `/two-factor/setup?next=${next}`,
                      requestUrl
                    ).toString()
                  )
                }
              }
            }
          }
        }
        return
      }

      // Dynamic Client Registration defaults an omitted `application_type`
      // to `web`, which rejects the loopback `http://127.0.0.1` callback that
      // native MCP clients such as opencode use. Default it to `native`.
      if (ctx.path !== "/oauth2/register") return
      const body = ctx.body as { application_type?: string } | undefined
      if (body && body.application_type === undefined) {
        body.application_type = "native"
      }
    }),
    // Member, role and invitation changes made through the auth endpoints are
    // audited here; server-action mutations record their own rows. The hook
    // context does not expose the resolved session, so it is looked up again
    // from the request headers (only for the handled paths).
    after: createAuthMiddleware(async (ctx) => {
      await recordAuthAuditEvent(ctx, async (requestHeaders) => {
        const result = await auth.api.getSession({ headers: requestHeaders })
        return result ? { user: result.user, session: result.session } : null
      })

      const userId = ctx.context.session?.user.id
      if (!userId || ctx.context.returned instanceof APIError) return
      await recordSessionRevocation(userId, ctx.path)

      if (ctx.path === "/organization/set-active") {
        await revokeOauthTokensForUser(userId)
      }
      if (ctx.path === "/sign-out") {
        const sessionId = ctx.context.session?.session.id
        if (sessionId) await revokeOauthTokensForSession(sessionId)
      }
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
          await revokeOauthTokensForUser(member.userId)
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
      resource: MCP_RESOURCE,
      // CIMD is the primary client-identity mechanism; DCR stays enabled as a
      // fallback for MCP clients that predate Client ID Metadata Documents
      // (e.g. opencode), which self-register over RFC 7591. See the register
      // hook above for the `application_type` default.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      resources: oauthResources(),
      scopes: oauthScopes(),
      accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
      refreshTokenReuseInterval: REFRESH_TOKEN_REUSE_SECONDS,
      cachedTrustedClients: trustedClientIds(),
      // Dynamic MCP clients only get the MCP audience. First-party app clients
      // are provisioned with their own resource in #182.
      clientRegistrationDefaultResources: [MCP_RESOURCE],
      postLogin: {
        page: "/select-organization",
        consentReferenceId: ({ session }) =>
          (session.activeOrganizationId as string | undefined) ?? undefined,
        shouldRedirect: ({ session }) => !session.activeOrganizationId,
      },
      customAccessTokenClaims: async ({ user, referenceId }) => {
        if (!user || !referenceId) return {}
        const [organization, member] = await Promise.all([
          prisma.organization.findUnique({
            where: { id: referenceId },
            select: {
              id: true,
              name: true,
              slug: true,
              requireTwoFactor: true,
              metadata: true,
              trialEndsAt: true,
              subscription: { select: { plan: true } },
            },
          }),
          prisma.member.findFirst({
            where: { organizationId: referenceId, userId: user.id },
            select: { role: true },
          }),
        ])
        if (!organization) return {}

        const plan = resolvePlan({
          metadata: organization.metadata,
          trialEndsAt: organization.trialEndsAt,
          subscription: organization.subscription ?? null,
        })

        return buildOAuthClaims({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            twoFactorEnabled: Boolean(user.twoFactorEnabled),
          },
          organization: {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            requireTwoFactor: organization.requireTwoFactor,
          },
          member,
          plan,
          requireTwoFactorEntitled: entitlementsFor(plan).requireTwoFactor,
        })
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

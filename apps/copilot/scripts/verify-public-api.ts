import "dotenv/config"

import { randomUUID } from "node:crypto"

import type { PublicApiMe } from "@workspace/contracts"

import { createApiToken, revokeApiToken } from "../lib/public-api"
import { prisma } from "../lib/prisma"

/**
 * End-to-end check of the public REST API against a running Copilot.
 *
 * Seeds a throwaway organization, user and token itself, then drives the HTTP
 * routes: the auth failures, organization isolation, scopes, rate limit and —
 * when the projects app is reachable — a create/get/update/delete round-trip
 * with an idempotent retry. No settings visit and no manual token.
 *
 *   npm run verify:public-api --workspace=copilot
 *   PUBLIC_API_URL=https://asynchrone.space npm run verify:public-api --workspace=copilot
 *
 * Requires the same database Copilot uses (DATABASE_URL / IDENTITY_DATABASE_URL)
 * and a running Copilot (and projects app for the domain round-trip).
 */

const BASE_URL = (
  process.env.PUBLIC_API_URL ??
  process.env.COPILOT_APP_URL ??
  "http://localhost:3000"
).replace(/\/$/, "")
const PROJECTS_URL = (process.env.PROJECTS_APP_URL ?? "").replace(/\/$/, "")

interface Envelope<T> {
  data: T
  meta: { requestId: string; nextCursor?: string | null; hasMore?: boolean }
}

interface ApiErrorBody {
  error: { code: string; message: string }
  meta: { requestId: string }
}

let failures = 0

function check(ok: boolean, message: string) {
  if (!ok) failures++
  console.log(`${ok ? "✓" : "✗ FAILED"} ${message}`)
}

function codeOf(body: unknown): string {
  return (body as ApiErrorBody | null)?.error?.code ?? ""
}

async function call<T>(
  path: string,
  init: RequestInit & { token?: string; organization?: string } = {}
): Promise<{ response: Response; body: T | ApiErrorBody | null }> {
  const headers = new Headers(init.headers)
  if (init.token) headers.set("authorization", `Bearer ${init.token}`)
  if (init.organization) {
    headers.set("x-asynchrone-organization", init.organization)
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await response.json().catch(() => null)) as
    T | ApiErrorBody | null
  return { response, body }
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
    return response.ok
  } catch {
    return false
  }
}

async function main() {
  console.log(`Public API verification against ${BASE_URL}\n`)

  const suffix = randomUUID().slice(0, 8)
  const organizationId = `org_verify_api_${suffix}`
  const userId = `user_verify_api_${suffix}`
  const userName = "Public API verifier"
  const userEmail = `verify-api-${suffix}@contract.local`
  const slug = `verify-api-${suffix}`
  const requestId = `verify-${suffix}`

  let projectId: string | null = null

  await prisma.organization.create({
    data: {
      id: organizationId,
      name: "Public API verification",
      slug,
      createdAt: new Date(),
    },
  })
  await prisma.user.create({
    data: { id: userId, name: userName, email: userEmail },
  })
  await prisma.member.create({
    data: {
      id: `member_verify_api_${suffix}`,
      organizationId,
      userId,
      role: "owner",
      createdAt: new Date(),
    },
  })

  const tokenCtx = {
    userId,
    userName,
    userEmail,
    organizationId,
    role: "owner" as const,
  }
  const created = await createApiToken(tokenCtx, {
    name: "verify-public-api",
    scopes: ["projects:read", "projects:write"],
  })
  const token = created.token

  try {
    const me = await call<Envelope<PublicApiMe>>("/api/v1/me", {
      token,
      headers: { "x-request-id": requestId },
    })
    check(me.response.status === 200, "GET /api/v1/me returns 200")
    const meBody = me.body as Envelope<PublicApiMe> | null
    check(
      meBody?.data.organization.id === organizationId,
      "me returns the token's organization"
    )
    check(
      meBody?.data.role === "owner",
      "me returns the creator's current role"
    )
    check(
      meBody?.data.token.scopes.join(",") === "projects:read,projects:write",
      "me returns the token's scopes"
    )
    check(meBody?.meta.requestId === requestId, "the request id is echoed")
    check(
      me.response.headers.get("cache-control") === "no-store",
      "responses are no-store"
    )
    check(
      Boolean(me.response.headers.get("x-ratelimit-limit")),
      "rate-limit headers are present"
    )

    const missing = await call("/api/v1/me")
    check(
      missing.response.status === 401 &&
        codeOf(missing.body) === "missing_token",
      "a request without a token is 401 missing_token"
    )

    const invalid = await call("/api/v1/me", {
      token: `async_${"0".repeat(43)}`,
    })
    check(
      invalid.response.status === 401 &&
        codeOf(invalid.body) === "invalid_token",
      "an unknown token is 401 invalid_token"
    )

    const otherOrg = await call("/api/v1/me", {
      token,
      organization: `org_someone_else_${suffix}`,
    })
    check(
      otherOrg.response.status === 403 &&
        codeOf(otherOrg.body) === "organization_mismatch",
      "another organization's id is 403 organization_mismatch"
    )

    const ownSlug = await call("/api/v1/me", { token, organization: slug })
    check(ownSlug.response.status === 200, "the token's own slug is accepted")

    const noScope = await call("/api/v1/employees", { token })
    check(
      noScope.response.status === 403 &&
        codeOf(noScope.body) === "insufficient_scope",
      "a missing scope is 403 insufficient_scope"
    )

    if (PROJECTS_URL && (await isReachable(`${PROJECTS_URL}/api/health`))) {
      const list = await call<Envelope<unknown[]>>("/api/v1/projects?limit=5", {
        token,
      })
      check(
        list.response.status === 200 &&
          Array.isArray((list.body as Envelope<unknown[]> | null)?.data),
        "GET /api/v1/projects delegates to the projects app"
      )
      if (list.response.status !== 200) {
        console.log(`  ${list.response.status} ${JSON.stringify(list.body)}`)
      }

      const idempotencyKey = `verify-${suffix}`
      const createdProject = await call<Envelope<{ id: string }>>(
        "/api/v1/projects",
        {
          method: "POST",
          token,
          headers: {
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify({ name: `API verification ${suffix}` }),
        }
      )
      projectId =
        (createdProject.body as Envelope<{ id: string }> | null)?.data.id ??
        null
      check(
        createdProject.response.status === 201 && Boolean(projectId),
        "POST /api/v1/projects creates a project"
      )

      const retried = await call<Envelope<{ id: string }>>("/api/v1/projects", {
        method: "POST",
        token,
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ name: `API verification ${suffix}` }),
      })
      check(
        (retried.body as Envelope<{ id: string }> | null)?.data.id ===
          projectId,
        "a retried mutation with the same Idempotency-Key returns the same row"
      )

      if (projectId) {
        const fetched = await call<Envelope<{ id: string }>>(
          `/api/v1/projects/${projectId}`,
          { token }
        )
        check(
          fetched.response.status === 200 &&
            (fetched.body as Envelope<{ id: string }> | null)?.data.id ===
              projectId,
          "GET /api/v1/projects/{id} returns the project"
        )

        const patched = await call<Envelope<{ name: string }>>(
          `/api/v1/projects/${projectId}`,
          {
            method: "PATCH",
            token,
            headers: {
              "content-type": "application/json",
              "idempotency-key": `verify-patch-${suffix}`,
            },
            body: JSON.stringify({
              name: `API verification ${suffix} (updated)`,
            }),
          }
        )
        check(
          patched.response.status === 200 &&
            (patched.body as Envelope<{ name: string }> | null)?.data.name ===
              `API verification ${suffix} (updated)`,
          "PATCH /api/v1/projects/{id} updates the project"
        )

        const deletedId = projectId
        const removed = await call<Envelope<{ id: string }>>(
          `/api/v1/projects/${deletedId}`,
          { method: "DELETE", token }
        )
        check(
          removed.response.status === 200 &&
            (removed.body as Envelope<{ id: string }> | null)?.data.id ===
              deletedId,
          "DELETE /api/v1/projects/{id} removes the project"
        )
        projectId = null

        const gone = await call(`/api/v1/projects/${deletedId}`, { token })
        check(
          gone.response.status === 404 && codeOf(gone.body) === "not_found",
          "a deleted project is 404 not_found"
        )
      }
    } else {
      console.log(
        "• domain round-trip skipped (projects app not reachable; set PROJECTS_APP_URL)"
      )
    }

    const limit = meBody?.data.limits.requestsPerMinute ?? 60
    if (limit > 0 && limit <= 200) {
      let limited: Response | null = null
      let limitedBody: unknown = null
      for (let attempt = 0; attempt < limit + 5; attempt++) {
        const response = await call("/api/v1/me", { token })
        if (response.response.status === 429) {
          limited = response.response
          limitedBody = response.body
          break
        }
      }
      check(
        limited !== null &&
          codeOf(limitedBody) === "rate_limited" &&
          Boolean(limited?.headers.get("retry-after")),
        `the token is rate-limited after ${limit} requests (429 + Retry-After)`
      )
    } else {
      console.log(`• rate-limit check skipped (plan limit ${limit}/min)`)
    }

    await revokeApiToken(tokenCtx, created.item.id)
    const revoked = await call("/api/v1/me", { token })
    check(
      revoked.response.status === 401 &&
        codeOf(revoked.body) === "revoked_token",
      "a revoked token is 401 revoked_token"
    )
  } finally {
    if (projectId) {
      await fetch(`${BASE_URL}/api/v1/projects/${projectId}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    await prisma.rateLimit
      .deleteMany({ where: { key: `api-token:${created.item.id}` } })
      .catch(() => {})
    await prisma.organization
      .deleteMany({ where: { id: organizationId } })
      .catch(() => {})
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {})
  }

  console.log(
    failures === 0
      ? "\nAll public API checks passed."
      : `\n${failures} public API check(s) failed.`
  )
  process.exitCode = failures > 0 ? 1 : 0
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

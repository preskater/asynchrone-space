import { describe, expect, it, vi } from "vitest"

import { handleAdminRequest } from "./handler"
import type { AdminRepository } from "./repository"

const organization = {
  id: "org_1",
  name: "Acme",
  slug: "acme",
  plan: "team" as const,
  subscriptionStatus: "active",
  manualOverride: true,
  trialEndsAt: null,
  deletionScheduledAt: null,
  memberCount: 4,
  storageQuotaBytes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
}

const user = {
  id: "user_1",
  name: "Ada",
  email: "ada@example.com",
  role: "platform_admin",
  banned: false,
  banReason: null,
  twoFactorEnabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
}

function repository(): AdminRepository {
  return {
    listOrganizations: vi.fn(async () => ({
      items: [organization],
      nextCursor: null,
      total: 1,
    })),
    getOrganization: vi.fn(async (id) =>
      id === "org_1" ? organization : null
    ),
    updatePlan: vi.fn(async () => organization),
    releasePlan: vi.fn(async () => organization),
    setTrial: vi.fn(async () => organization),
    listUsers: vi.fn(async () => ({
      items: [user],
      nextCursor: null,
      total: 1,
    })),
    getUser: vi.fn(async (id) => (id === "user_1" ? user : null)),
    setBan: vi.fn(async () => ({ ...user, banned: true })),
    revokeSessions: vi.fn(async () => ({ deleted: 2 })),
    createHandoff: vi.fn(async () => ({
      url: "https://copilot.example/api/platform/handoff?token=t",
    })),
  }
}

async function call(
  segments: string[],
  method = "GET",
  body?: unknown,
  authorize: () => Promise<unknown> = async () => undefined
) {
  return handleAdminRequest({
    segments,
    request: new Request("https://copilot.example/internal/v1/admin/x", {
      method,
      ...(body === undefined
        ? {}
        : {
            body: JSON.stringify(body),
            headers: { "content-type": "application/json" },
          }),
    }),
    authorize,
    repository: repository(),
  })
}

describe("admin handler", () => {
  it("lists organizations and users", async () => {
    const organizations = await call(["organizations"])
    expect((await organizations.json()).data.items[0].id).toBe("org_1")

    const users = await call(["users"])
    expect((await users.json()).data.items[0].id).toBe("user_1")
  })

  it("returns 404 for an unknown entity", async () => {
    expect((await call(["organizations", "missing"])).status).toBe(404)
    expect((await call(["users", "missing"])).status).toBe(404)
  })

  it("changes a plan, bans a user and creates a handoff", async () => {
    const plan = await call(["organizations", "org_1", "plan"], "POST", {
      plan: "enterprise",
      quotaBytes: 1000,
    })
    expect(plan.status).toBe(200)

    const ban = await call(["users", "user_1", "ban"], "POST", {
      banned: true,
      reason: "abuse",
    })
    expect((await ban.json()).data.banned).toBe(true)

    const handoff = await call(["handoffs"], "POST", {
      userId: "user_1",
    })
    expect((await handoff.json()).data.url).toContain("/api/platform/handoff")
  })

  it("rejects an invalid body and a missing token", async () => {
    expect(
      (await call(["organizations", "org_1", "plan"], "POST", { plan: "x" }))
        .status
    ).toBe(400)

    const unauthorized = await call(
      ["organizations"],
      "GET",
      undefined,
      async () => {
        throw Object.assign(new Error("no"), {
          status: 403,
          code: "insufficient_scope",
          message: "No admin scope",
        })
      }
    )
    expect(unauthorized.status).toBe(403)
  })
})

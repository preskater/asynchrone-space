import { describe, expect, it, vi } from "vitest"

import { IdentityAdminClient } from "./identity-admin"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

const organization = {
  id: "org_1",
  name: "Acme",
  slug: "acme",
  plan: "team",
  subscriptionStatus: "active",
  manualOverride: true,
  trialEndsAt: null,
  deletionScheduledAt: null,
  memberCount: 3,
  storageQuotaBytes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
}

describe("identity admin client", () => {
  it("lists organizations with the admin scope", async () => {
    const token = vi.fn(async () => "admin-token")
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        "https://copilot.example/internal/v1/admin/organizations?query=acme&limit=10"
      )
      return json({
        data: { items: [organization], nextCursor: null, total: 1 },
      })
    })
    const client = new IdentityAdminClient({
      baseUrl: "https://copilot.example",
      getToken: token,
      fetchImpl: fetchImpl as typeof fetch,
    })

    const page = await client.listOrganizations({ query: "acme", limit: 10 })
    expect(page.items[0]?.plan).toBe("team")
    expect(token).toHaveBeenCalledWith({
      audience: "urn:asynchrone:app:copilot",
      scopes: ["internal:identity:admin"],
    })
  })

  it("updates a plan and creates a handoff", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/handoffs")) {
          expect(JSON.parse(String(init?.body))).toMatchObject({
            userId: "user_1",
          })
          return json({
            data: {
              url: "https://copilot.example/api/platform/handoff?token=t",
            },
          })
        }
        expect(JSON.parse(String(init?.body))).toMatchObject({
          plan: "enterprise",
        })
        return json({ data: organization })
      }
    )
    const client = new IdentityAdminClient({
      baseUrl: "https://copilot.example",
      getToken: async () => "token",
      fetchImpl: fetchImpl as typeof fetch,
    })

    await expect(
      client.updatePlan("org_1", { plan: "enterprise", quotaBytes: null })
    ).resolves.toMatchObject({ id: "org_1" })
    await expect(
      client.createHandoff({ userId: "user_1" })
    ).resolves.toMatchObject({ url: expect.stringContaining("handoff") })
  })

  it("maps an API error", async () => {
    const client = new IdentityAdminClient({
      baseUrl: "https://copilot.example",
      getToken: async () => "token",
      fetchImpl: (async () =>
        json(
          { error: { code: "forbidden", message: "No" } },
          403
        )) as typeof fetch,
    })
    await expect(client.getUser("user_1")).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    })
  })
})

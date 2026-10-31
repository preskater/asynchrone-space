import { describe, expect, it, vi } from "vitest"

import { IdentityClient, IdentityClientError } from "./identity"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

function client(fetchImpl: typeof fetch, now: () => number) {
  return new IdentityClient({
    baseUrl: "https://copilot.asynchrone.space",
    getToken: async () => "service-token",
    fetchImpl,
    now,
    ttlMs: 30_000,
  })
}

const organization = { id: "org_1", name: "Acme", slug: "acme" }
const member = {
  id: "user_1",
  name: "Ada",
  email: "ada@example.com",
  role: "owner",
  clientId: null,
}

describe("identity client", () => {
  it("fetches and parses an organization with a service token", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "https://copilot.asynchrone.space/internal/v1/organizations/org_1"
        )
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer service-token",
        })
        return json({ data: organization })
      }
    )

    const identity = client(fetchImpl as typeof fetch, () => 1_000)
    await expect(identity.getOrganization("org_1")).resolves.toEqual(
      organization
    )
  })

  it("caches results for the TTL", async () => {
    let now = 1_000
    const fetchImpl = vi.fn(async () => json({ data: [member] }))
    const identity = client(fetchImpl as typeof fetch, () => now)

    expect(await identity.listMembers("org_1")).toEqual([member])
    expect(await identity.listMembers("org_1")).toEqual([member])
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    now += 30_001
    expect(await identity.listMembers("org_1")).toEqual([member])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("invalidates a cached organization subtree", async () => {
    const fetchImpl = vi.fn(async () => json({ data: organization }))
    const identity = client(fetchImpl as typeof fetch, () => 1_000)

    await identity.getOrganization("org_1")
    identity.invalidate("org_1")
    await identity.getOrganization("org_1")
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("maps an API error", async () => {
    const fetchImpl = vi.fn(async () =>
      json(
        { error: { code: "not_found", message: "Organization not found" } },
        404
      )
    )
    const identity = client(fetchImpl as typeof fetch, () => 1_000)
    await expect(identity.getOrganization("missing")).rejects.toEqual(
      expect.objectContaining<Partial<IdentityClientError>>({
        code: "not_found",
        message: "Organization not found",
        status: 404,
      })
    )
  })

  it("rejects a malformed success envelope", async () => {
    const fetchImpl = vi.fn(async () => json({ nope: true }))
    const identity = client(fetchImpl as typeof fetch, () => 1_000)
    await expect(identity.getUser("user_1")).rejects.toMatchObject({
      code: "invalid_response",
    })
  })
})

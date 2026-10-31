import { describe, expect, it, vi } from "vitest"

import { AuditClient, AuditClientError } from "./audit"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

const entry = {
  id: "row_1",
  createdAt: "2026-01-01T10:00:00.000Z",
  actorId: "user_1",
  actorName: "Ada",
  actorEmail: "ada@example.com",
  action: "project.created",
  entityType: "project",
  entityId: "project_1",
  entityLabel: "Project",
  ipAddress: null,
  userAgent: null,
  before: null,
  after: { name: "Project" },
}

describe("audit client", () => {
  it("lists with the read scope and parses the page", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const token = vi.fn(async () => "service-token")
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(input), init })
        return json({
          data: { items: [entry], nextCursor: "next", total: 1, partial: true },
        })
      }
    )
    const client = new AuditClient({
      app: "projects",
      baseUrl: "https://projects.example",
      getToken: token,
      fetchImpl: fetchImpl as typeof fetch,
    })

    const page = await client.list("org_1", {
      action: "project.created",
      cursor: "cursor",
      limit: 10,
    })
    expect(page.items[0]?.id).toBe("row_1")
    expect(page.partial).toBe(true)
    expect(token).toHaveBeenCalledWith({
      audience: "urn:asynchrone:app:projects",
      scopes: ["internal:audit:read"],
    })
    expect(requests[0]?.url).toContain(
      "/internal/v1/audit?organizationId=org_1&action=project.created&cursor=cursor&limit=10"
    )
    expect(requests[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer service-token",
    })
  })

  it("loads facets and exports", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/facets")) {
        return json({
          data: {
            actions: [{ value: "project.created", count: 1 }],
            entityTypes: [],
            actors: [],
          },
        })
      }
      return json({ data: { entries: [entry], truncated: false } })
    })
    const client = new AuditClient({
      app: "projects",
      baseUrl: "https://projects.example",
      getToken: async () => "token",
      fetchImpl: fetchImpl as typeof fetch,
    })

    expect((await client.facets("org_1")).actions[0]?.count).toBe(1)
    expect(
      (await client.export("org_1", { from: "2026-01-01" })).entries
    ).toHaveLength(1)
  })

  it("prunes with the write scope", async () => {
    const token = vi.fn(async () => "token")
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "https://projects.example/internal/v1/audit/prune"
        )
        expect(init?.method).toBe("POST")
        expect(JSON.parse(String(init?.body))).toMatchObject({
          organizations: [{ organizationId: "org_1" }],
        })
        return json({ data: { organizations: 1, deleted: 4, capped: 0 } })
      }
    )
    const client = new AuditClient({
      app: "projects",
      baseUrl: "https://projects.example",
      getToken: token,
      fetchImpl: fetchImpl as typeof fetch,
    })

    await expect(
      client.prune({
        organizations: [
          { organizationId: "org_1", before: "2026-01-01T00:00:00.000Z" },
        ],
      })
    ).resolves.toMatchObject({ deleted: 4 })
    expect(token).toHaveBeenCalledWith({
      audience: "urn:asynchrone:app:projects",
      scopes: ["internal:audit:write"],
    })
  })

  it("maps an API error", async () => {
    const client = new AuditClient({
      app: "projects",
      baseUrl: "https://projects.example",
      getToken: async () => "token",
      fetchImpl: (async () =>
        json(
          { error: { code: "not_found", message: "No audit rows" } },
          404
        )) as typeof fetch,
    })
    await expect(client.list("org_1")).rejects.toEqual(
      expect.objectContaining({
        code: "not_found",
        status: 404,
      } satisfies Partial<AuditClientError>)
    )
  })
})

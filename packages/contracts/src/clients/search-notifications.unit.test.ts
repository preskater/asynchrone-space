import { describe, expect, it, vi } from "vitest"

import { NotificationClient } from "./notifications"
import { SearchClient } from "./search"

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("search client", () => {
  it("uses the target app audience and search scope", async () => {
    const token = vi.fn(async () => "search-token")
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain(
        "/internal/v1/search?organizationId=org_1&q=login&limit=5"
      )
      return json({ data: { results: [] } })
    })
    const client = new SearchClient({
      app: "projects",
      baseUrl: "https://projects.example",
      getToken: token,
      fetchImpl: fetchImpl as typeof fetch,
    })
    await client.search("org_1", "login", 5)
    expect(token).toHaveBeenCalledWith({
      audience: "urn:asynchrone:app:projects",
      scopes: ["internal:search:read"],
    })
  })
})

describe("notification client", () => {
  it("posts an idempotent notification to Copilot", async () => {
    const token = vi.fn(async () => "notification-token")
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          "https://copilot.example/internal/v1/notifications"
        )
        expect(JSON.parse(String(init?.body))).toMatchObject({
          idempotencyKey: "task.assigned:task_1",
        })
        return json({ data: { created: false } })
      }
    )
    const client = new NotificationClient({
      baseUrl: "https://copilot.example",
      getToken: token,
      fetchImpl: fetchImpl as typeof fetch,
    })

    await expect(
      client.create({
        organizationId: "org_1",
        userId: "user_1",
        type: "task.assigned",
        title: "Assigned",
        idempotencyKey: "task.assigned:task_1",
      })
    ).resolves.toEqual({ created: false })
    expect(token).toHaveBeenCalledWith({
      audience: "urn:asynchrone:app:copilot",
      scopes: ["internal:notifications:write"],
    })
  })
})

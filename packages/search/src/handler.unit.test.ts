import { describe, expect, it } from "vitest"

import { createSearchHandler } from "./handler"

const result = {
  app: "projects",
  type: "task",
  id: "task_1",
  title: "Fix login",
  url: "https://projects.example/tasks/task_1",
}

describe("search handler", () => {
  it("returns this app's results", async () => {
    const GET = createSearchHandler({
      app: "projects",
      authorize: async () => undefined,
      search: async () => [result],
    })
    const response = await GET(
      new Request(
        "https://projects.example/internal/v1/search?organizationId=org_1&q=login&limit=5"
      )
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data.results).toEqual([result])
  })

  it("rejects an invalid query", async () => {
    const GET = createSearchHandler({
      app: "projects",
      authorize: async () => undefined,
      search: async () => [],
    })
    expect(
      (await GET(new Request("https://projects.example/internal/v1/search")))
        .status
    ).toBe(400)
  })

  it("maps an authorization failure", async () => {
    const GET = createSearchHandler({
      app: "projects",
      authorize: async () => {
        throw Object.assign(new Error("no"), {
          status: 403,
          code: "insufficient_scope",
          message: "No search scope",
        })
      },
      search: async () => [],
    })
    const response = await GET(
      new Request(
        "https://projects.example/internal/v1/search?organizationId=org_1&q=a"
      )
    )
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe("insufficient_scope")
  })
})

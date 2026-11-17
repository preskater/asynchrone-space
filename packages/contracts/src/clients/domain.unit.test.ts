import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { internalAudience } from "../apps"
import { SERVICE_SCOPES } from "../internal/contracts"
import type { DelegatedContext } from "../internal/domain"
import { DomainClient, DomainClientError } from "./domain"

const context: DelegatedContext = {
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
  organizationId: "org_1",
  role: "member",
  impersonatedBy: null,
  portal: null,
}

function build(fetchImpl: () => Promise<Response>, writeRetries = 0) {
  const getToken = vi.fn(async () => "token")
  const client = new DomainClient({
    app: "projects",
    baseUrl: "https://projects.example",
    getToken,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    readRetries: 0,
    writeRetries,
  })
  return { client, getToken }
}

const ok = () =>
  Response.json({
    data: { ok: true },
    meta: { app: "projects", version: "v1", requestId: "r" },
  })

const down = () =>
  Response.json(
    { error: { code: "domain_unavailable", message: "down" } },
    { status: 503 }
  )

const schema = z.object({ ok: z.boolean() })

describe("DomainClient operation scope", () => {
  it("requests the write scope for a public delete operation", async () => {
    const { client, getToken } = build(async () => ok(), 1)
    await client.call("public-delete-project", context, {}, schema, {
      idempotencyKey: "idem_1",
    })
    expect(getToken).toHaveBeenCalledWith({
      audience: internalAudience("projects"),
      scopes: [SERVICE_SCOPES.domainWrite],
    })
  })

  it("requests the read scope for a paginated list", async () => {
    const { client, getToken } = build(async () => ok())
    await client.call("list-projects-page", context, {}, schema)
    expect(getToken).toHaveBeenCalledWith({
      audience: internalAudience("projects"),
      scopes: [SERVICE_SCOPES.domainRead],
    })
  })
})

describe("DomainClient write retries", () => {
  it("does not retry a write without an idempotency key", async () => {
    const fetchImpl = vi.fn(async () => down())
    const { client } = build(fetchImpl, 1)
    await expect(
      client.call("public-delete-project", context, {}, schema)
    ).rejects.toBeInstanceOf(DomainClientError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("retries a write when the caller supplies an idempotency key", async () => {
    const fetchImpl = vi.fn(async () => down())
    const { client } = build(fetchImpl, 1)
    await expect(
      client.call("public-delete-project", context, {}, schema, {
        idempotencyKey: "idem_1",
      })
    ).rejects.toBeInstanceOf(DomainClientError)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})

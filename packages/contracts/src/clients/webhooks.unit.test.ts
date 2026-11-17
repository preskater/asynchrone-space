import { describe, expect, it, vi } from "vitest"

import { internalAudience } from "../apps"
import { SERVICE_SCOPES } from "../internal/contracts"
import { WebhookClient, WebhookClientError } from "./webhooks"

const envelope = {
  id: "evt_1",
  type: "member.added" as const,
  occurredAt: "2026-01-01T00:00:00.000Z",
  organizationId: "org_1",
  data: {
    member: {
      userId: "user_1",
      name: "Ada",
      email: "ada@example.com",
      role: "member",
    },
  },
}

describe("WebhookClient", () => {
  it("posts the envelope with the webhooks scope and audience", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ data: { queued: 1 } }))
    const getToken = vi.fn(async () => "service-token")
    const client = new WebhookClient({
      baseUrl: "https://copilot.example",
      getToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    await expect(client.emit(envelope)).resolves.toEqual({ queued: 1 })

    expect(getToken).toHaveBeenCalledWith({
      audience: internalAudience("copilot"),
      scopes: [SERVICE_SCOPES.webhooksWrite],
    })
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [
      URL,
      RequestInit,
    ]
    expect(url.toString()).toBe(
      "https://copilot.example/internal/v1/webhooks/events"
    )
    expect(init.headers).toMatchObject({
      Authorization: "Bearer service-token",
      "Content-Type": "application/json",
    })
    expect(JSON.parse(init.body as string)).toEqual(envelope)
  })

  it("maps an error response to a typed client error", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { error: { code: "forbidden", message: "no" } },
        { status: 403 }
      )
    )
    const client = new WebhookClient({
      baseUrl: "https://copilot.example",
      getToken: async () => "service-token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const error = await client.emit(envelope).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(WebhookClientError)
    expect(error).toMatchObject({ code: "forbidden", status: 403 })
  })
})

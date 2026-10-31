import { describe, expect, it, vi } from "vitest"

import { ServiceTokenClient } from "./client"
import { SERVICE_SCOPES } from "./verify"

const config = {
  issuer: "https://copilot.asynchrone.space",
  clientId: "projects",
  clientSecret: "secret",
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("service token client", () => {
  it("requests a client-credentials token with audience and scope", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.method).toBe("POST")
        const headers = init?.headers as Record<string, string>
        expect(headers.Authorization).toBe(
          `Basic ${Buffer.from("projects:secret").toString("base64")}`
        )
        const body = init?.body as URLSearchParams
        expect(body.get("grant_type")).toBe("client_credentials")
        expect(body.get("resource")).toBe("urn:asynchrone:app:files")
        expect(body.get("scope")).toBe(SERVICE_SCOPES.identityRead)
        return jsonResponse({
          access_token: "service_token",
          token_type: "Bearer",
          expires_in: 300,
        })
      }
    )

    const client = new ServiceTokenClient(
      { ...config, fetchImpl: fetchImpl as typeof fetch },
      { now: () => 1_000 }
    )
    const token = await client.getToken({
      audience: "urn:asynchrone:app:files",
      scopes: [SERVICE_SCOPES.identityRead],
    })
    expect(token).toBe("service_token")
  })

  it("caches a token until shortly before expiry", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        access_token: "service_token",
        token_type: "Bearer",
        expires_in: 300,
      })
    )
    let now = 1_000
    const client = new ServiceTokenClient(
      { ...config, fetchImpl: fetchImpl as typeof fetch },
      { now: () => now, skewMs: 30_000 }
    )
    const request = {
      audience: "urn:asynchrone:app:files",
      scopes: [SERVICE_SCOPES.identityRead],
    }
    expect(await client.getToken(request)).toBe("service_token")
    expect(await client.getToken(request)).toBe("service_token")
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    now = 1_000 + 300_000 - 10_000
    expect(await client.getToken(request)).toBe("service_token")
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it("rejects an empty scope set and an OAuth error", async () => {
    const client = new ServiceTokenClient(config)
    await expect(
      client.getToken({ audience: "urn:asynchrone:app:files", scopes: [] })
    ).rejects.toMatchObject({ code: "missing_scope" })

    const failing = new ServiceTokenClient({
      ...config,
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          { error: "invalid_client", error_description: "Bad secret" },
          401
        )
      ) as typeof fetch,
    })
    await expect(
      failing.getToken({
        audience: "urn:asynchrone:app:files",
        scopes: [SERVICE_SCOPES.identityRead],
      })
    ).rejects.toMatchObject({ code: "invalid_client", status: 401 })
  })
})

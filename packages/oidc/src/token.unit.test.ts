import { describe, expect, it, vi } from "vitest"

import type { OidcConfig } from "./config"
import {
  exchangeAuthorizationCode,
  OidcError,
  refreshAccessToken,
} from "./token"

const config: OidcConfig = {
  issuer: "https://copilot.asynchrone.space",
  clientId: "projects",
  clientSecret: "secret",
  redirectUri: "https://projects.copilot.asynchrone.space/api/auth/callback",
  resource: "urn:asynchrone:app:projects",
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
}

describe("token exchange", () => {
  it("exchanges an authorization code with PKCE and client auth", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.method).toBe("POST")
        expect(init?.headers).toMatchObject({
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        })
        const headers = init?.headers as Record<string, string>
        expect(headers.Authorization).toBe(
          `Basic ${Buffer.from("projects:secret").toString("base64")}`
        )
        const body = init?.body as URLSearchParams
        expect(body.get("grant_type")).toBe("authorization_code")
        expect(body.get("code")).toBe("code_1")
        expect(body.get("code_verifier")).toBe("verifier_1")
        expect(body.get("resource")).toBe(config.resource)
        return jsonResponse({
          access_token: "access_1",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token: "refresh_1",
          scope: "openid app:read",
        })
      }
    )

    const tokens = await exchangeAuthorizationCode(config, {
      code: "code_1",
      codeVerifier: "verifier_1",
      fetchImpl: fetchImpl as typeof fetch,
      now: 1_000,
    })

    expect(tokens.access_token).toBe("access_1")
    expect(tokens.refresh_token).toBe("refresh_1")
    expect(tokens.expires_at).toBe(1_000 + 900_000)
  })

  it("raises a typed error for an OAuth error response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { error: "invalid_grant", error_description: "Code expired" },
        400
      )
    )

    await expect(
      exchangeAuthorizationCode(config, {
        code: "code_1",
        codeVerifier: "verifier_1",
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: "invalid_grant",
        message: "Code expired",
        status: 400,
      } satisfies Partial<OidcError>)
    )
  })

  it("refreshes with the rotating refresh token and resource", async () => {
    const fetchImpl = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body as URLSearchParams
        expect(body.get("grant_type")).toBe("refresh_token")
        expect(body.get("refresh_token")).toBe("refresh_1")
        expect(body.get("resource")).toBe(config.resource)
        return jsonResponse({
          access_token: "access_2",
          token_type: "Bearer",
          expires_in: 900,
          refresh_token: "refresh_2",
        })
      }
    )

    const tokens = await refreshAccessToken(config, {
      refreshToken: "refresh_1",
      fetchImpl: fetchImpl as typeof fetch,
      now: 2_000,
    })
    expect(tokens.access_token).toBe("access_2")
    expect(tokens.refresh_token).toBe("refresh_2")
    expect(tokens.expires_at).toBe(2_000 + 900_000)
  })

  it("rejects a malformed token response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ token_type: "Bearer" }))
    await expect(
      exchangeAuthorizationCode(config, {
        code: "code_1",
        codeVerifier: "verifier_1",
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "invalid_token_response" })
  })
})

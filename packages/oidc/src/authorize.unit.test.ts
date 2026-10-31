import { describe, expect, it } from "vitest"

import { createAuthorizationRequest } from "./authorize"
import {
  clearOAuthCookies,
  clearSessionCookie,
  oauthStateCookieName,
  parseCookieHeader,
  readOAuthCookies,
  serializeOAuthCookies,
  serializeSessionCookie,
} from "./cookies"
import type { OidcConfig } from "./config"

const config: OidcConfig = {
  issuer: "https://copilot.asynchrone.space",
  clientId: "projects",
  clientSecret: "secret",
  redirectUri: "https://projects.copilot.asynchrone.space/api/auth/callback",
  resource: "urn:asynchrone:app:projects",
}

describe("authorization request", () => {
  it("builds an authorization-code + PKCE URL", () => {
    const request = createAuthorizationRequest(config, {
      state: "state_1",
      codeVerifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    })
    const url = new URL(request.url)
    expect(url.origin).toBe("https://copilot.asynchrone.space")
    expect(url.pathname).toBe("/api/auth/oauth2/authorize")
    expect(url.searchParams.get("response_type")).toBe("code")
    expect(url.searchParams.get("client_id")).toBe("projects")
    expect(url.searchParams.get("resource")).toBe(config.resource)
    expect(url.searchParams.get("scope")).toContain("app:read")
    expect(url.searchParams.get("scope")).toContain("offline_access")
    expect(url.searchParams.get("state")).toBe("state_1")
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("nonce")).toBeTruthy()
  })

  it("adds an optional prompt", () => {
    const request = createAuthorizationRequest(config, { prompt: "none" })
    expect(new URL(request.url).searchParams.get("prompt")).toBe("none")
  })
})

describe("cookies", () => {
  it("uses a secure host-only session cookie", () => {
    const cookie = serializeSessionCookie(config, "session_1")
    expect(cookie).toContain("__Host-asynchrone_session=session_1")
    expect(cookie).toContain("Path=/")
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=Lax")
    expect(cookie).toContain("Secure")
    expect(cookie).not.toContain("Domain=")
  })

  it("uses the non-prefixed name in insecure development", () => {
    const cookie = serializeSessionCookie(
      { ...config, secureCookies: false },
      "session_1"
    )
    expect(cookie).toContain("asynchrone_session=session_1")
    expect(cookie).not.toContain("Secure")
  })

  it("serializes and clears the OAuth state cookies", () => {
    const values = { state: "s", verifier: "v", nonce: "n" }
    const cookies = serializeOAuthCookies(config, values)
    expect(cookies).toHaveLength(3)
    const parsed = parseCookieHeader(
      cookies.map((c) => c.split(";")[0]).join("; ")
    )
    expect(parsed[oauthStateCookieName(config)]).toBe("s")
    expect(clearOAuthCookies(config)[0]).toContain("Max-Age=0")
    expect(clearSessionCookie(config)).toContain("Max-Age=0")
  })

  it("reads the OAuth cookies from a header", () => {
    const cookies = serializeOAuthCookies(config, {
      state: "s",
      verifier: "v",
      nonce: "n",
    })
    const header = cookies.map((cookie) => cookie.split(";")[0]).join("; ")
    expect(readOAuthCookies(config, header)).toEqual({
      state: "s",
      verifier: "v",
      nonce: "n",
    })
  })
})

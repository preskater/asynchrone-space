import { describe, expect, it, vi } from "vitest"

import { completeAuthorization } from "./callback"
import type { OidcConfig } from "./config"
import { buildEndSessionUrl, handleBackChannelLogout } from "./logout"
import { MemorySessionStore, sessionRecordFromTokens } from "./session"

const config: OidcConfig = {
  issuer: "https://copilot.asynchrone.space",
  clientId: "projects",
  clientSecret: "secret",
  redirectUri: "https://projects.copilot.asynchrone.space/api/auth/callback",
  resource: "https://projects.copilot.asynchrone.space",
}

const tokenResponse = {
  access_token: "access_1",
  token_type: "Bearer",
  expires_in: 900,
  refresh_token: "refresh_1",
}

describe("callback", () => {
  it("validates state, exchanges the code and creates a local session", async () => {
    const store = new MemorySessionStore()
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(tokenResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
    const completed = await completeAuthorization(config, store, {
      code: "code_1",
      state: "state_1",
      expectedState: "state_1",
      codeVerifier: "verifier_1",
      fetchImpl: fetchImpl as typeof fetch,
      verify: async () => ({
        sub: "user_1",
        sid: "sid_1",
        org: "org_1",
      }),
    })

    expect(completed.session).toMatchObject({
      userId: "user_1",
      organizationId: "org_1",
      sid: "sid_1",
      accessToken: "access_1",
    })
    expect(completed.setCookies[0]).toContain("__Host-asynchrone_session=")
    expect(
      completed.setCookies.slice(1).every((c) => c.includes("Max-Age=0"))
    ).toBe(true)
  })

  it("rejects a mismatched state before exchanging the code", async () => {
    const store = new MemorySessionStore()
    const fetchImpl = vi.fn()
    await expect(
      completeAuthorization(config, store, {
        code: "code_1",
        state: "wrong",
        expectedState: "state_1",
        codeVerifier: "verifier_1",
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).rejects.toMatchObject({ code: "invalid_state" })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("requires session and organization claims", async () => {
    const store = new MemorySessionStore()
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(tokenResponse), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
    )
    await expect(
      completeAuthorization(config, store, {
        code: "code_1",
        state: "state_1",
        expectedState: "state_1",
        codeVerifier: "verifier_1",
        fetchImpl: fetchImpl as typeof fetch,
        verify: async () => ({ sub: "user_1", org: "org_1" }),
      })
    ).rejects.toMatchObject({ code: "missing_sid" })
  })
})

describe("logout", () => {
  it("deletes local sessions by sid from a verified logout token", async () => {
    const store = new MemorySessionStore()
    await store.create(
      sessionRecordFromTokens({
        tokens: {
          ...tokenResponse,
          expires_at: Date.now() + 900_000,
        },
        userId: "user_1",
        organizationId: "org_1",
        sid: "sid_1",
        id: "session_1",
      })
    )

    await handleBackChannelLogout(config, store, "logout_token", async () => ({
      sid: "sid_1",
      iss: config.issuer,
      aud: config.clientId,
    }))

    expect(await store.get("session_1")).toBeNull()
  })

  it("builds the RP-initiated logout URL", () => {
    const url = new URL(
      buildEndSessionUrl(config, {
        idToken: "id_1",
        postLogoutRedirectUri: "https://asynchrone.space/",
        state: "s",
      })
    )
    expect(url.pathname).toBe("/api/auth/oauth2/end-session")
    expect(url.searchParams.get("id_token_hint")).toBe("id_1")
    expect(url.searchParams.get("client_id")).toBe("projects")
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://asynchrone.space/"
    )
  })
})

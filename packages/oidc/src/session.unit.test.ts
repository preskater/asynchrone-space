import { describe, expect, it, vi } from "vitest"

import type { OidcConfig } from "./config"
import {
  MemorySessionStore,
  createSession,
  resolveSession,
  sessionRecordFromTokens,
} from "./session"

const config: OidcConfig = {
  issuer: "https://copilot.asynchrone.space",
  clientId: "projects",
  clientSecret: "secret",
  redirectUri: "https://projects.copilot.asynchrone.space/api/auth/callback",
  resource: "https://projects.copilot.asynchrone.space",
}

const tokens = {
  access_token: "access_1",
  token_type: "Bearer",
  expires_in: 900,
  expires_at: 1_900_000,
  refresh_token: "refresh_1",
}

describe("OIDC sessions", () => {
  it("creates a session from a token response", async () => {
    const store = new MemorySessionStore()
    const session = await createSession(store, {
      tokens,
      userId: "user_1",
      organizationId: "org_1",
      sid: "sid_1",
      id: "session_1",
      now: 1_000,
    })
    expect(session).toMatchObject({
      id: "session_1",
      userId: "user_1",
      organizationId: "org_1",
      sid: "sid_1",
      accessToken: "access_1",
      refreshToken: "refresh_1",
    })
    expect(await store.get("session_1")).toEqual(session)
  })

  it("returns a valid session without refreshing", async () => {
    const store = new MemorySessionStore()
    const record = sessionRecordFromTokens({
      tokens,
      userId: "user_1",
      organizationId: "org_1",
      sid: "sid_1",
      id: "session_1",
    })
    record.accessTokenExpiresAt = 100_000
    await store.create(record)
    const fetchImpl = vi.fn()
    const resolved = await resolveSession(store, config, "session_1", {
      fetchImpl: fetchImpl as typeof fetch,
      now: 1_000,
    })
    expect(resolved?.accessToken).toBe("access_1")
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it("refreshes an expired access token and rotates the refresh token", async () => {
    const store = new MemorySessionStore()
    const record = sessionRecordFromTokens({
      tokens,
      userId: "user_1",
      organizationId: "org_1",
      sid: "sid_1",
      id: "session_1",
    })
    record.accessTokenExpiresAt = 1_000
    await store.create(record)

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            access_token: "access_2",
            token_type: "Bearer",
            expires_in: 900,
            refresh_token: "refresh_2",
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    )

    const resolved = await resolveSession(store, config, "session_1", {
      fetchImpl: fetchImpl as typeof fetch,
      now: 2_000,
    })
    expect(resolved).toMatchObject({
      accessToken: "access_2",
      refreshToken: "refresh_2",
      accessTokenExpiresAt: 902_000,
    })
    expect(await store.get("session_1")).toMatchObject({
      accessToken: "access_2",
      refreshToken: "refresh_2",
    })
  })

  it("deletes the local session when refresh fails", async () => {
    const store = new MemorySessionStore()
    const record = sessionRecordFromTokens({
      tokens,
      userId: "user_1",
      organizationId: "org_1",
      sid: "sid_1",
      id: "session_1",
    })
    record.accessTokenExpiresAt = 1_000
    await store.create(record)

    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "invalid_grant" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        })
    )

    expect(
      await resolveSession(store, config, "session_1", {
        fetchImpl: fetchImpl as typeof fetch,
        now: 2_000,
      })
    ).toBeNull()
    expect(await store.get("session_1")).toBeNull()
  })

  it("deletes sessions by Copilot sid", async () => {
    const store = new MemorySessionStore()
    await store.create(
      sessionRecordFromTokens({
        tokens,
        userId: "user_1",
        organizationId: "org_1",
        sid: "sid_1",
        id: "session_1",
      })
    )
    await store.deleteBySid("sid_1")
    expect(await store.get("session_1")).toBeNull()
  })
})

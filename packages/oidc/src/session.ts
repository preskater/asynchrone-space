import { normalizeConfig, type OidcConfig } from "./config"
import { refreshAccessToken, type OidcFetch, type TokenResponse } from "./token"

/**
 * Storage contract for an app-local OIDC session. Each app stores the row in
 * its own database; `#183` provides the Prisma adapter, and this package ships
 * an in-memory implementation for tests.
 */
export interface OidcSessionRecord {
  id: string
  /** Copilot user id (`sub`). */
  userId: string
  /** Copilot organization id from the token claim. */
  organizationId: string
  /** Copilot session id used by back-channel logout. */
  sid: string
  accessToken: string
  refreshToken: string | null
  /** Unix milliseconds. */
  accessTokenExpiresAt: number
  createdAt: number
  updatedAt: number
}

export type OidcSessionPatch = Partial<
  Pick<
    OidcSessionRecord,
    "accessToken" | "refreshToken" | "accessTokenExpiresAt" | "updatedAt"
  >
>

export interface OidcSessionStore {
  create(record: OidcSessionRecord): Promise<void>
  get(id: string): Promise<OidcSessionRecord | null>
  update(id: string, patch: OidcSessionPatch): Promise<void>
  delete(id: string): Promise<void>
  deleteBySid(sid: string): Promise<void>
}

export class MemorySessionStore implements OidcSessionStore {
  private readonly sessions = new Map<string, OidcSessionRecord>()

  async create(record: OidcSessionRecord): Promise<void> {
    this.sessions.set(record.id, record)
  }

  async get(id: string): Promise<OidcSessionRecord | null> {
    return this.sessions.get(id) ?? null
  }

  async update(id: string, patch: OidcSessionPatch): Promise<void> {
    const current = this.sessions.get(id)
    if (current) this.sessions.set(id, { ...current, ...patch })
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id)
  }

  async deleteBySid(sid: string): Promise<void> {
    for (const [id, record] of this.sessions) {
      if (record.sid === sid) this.sessions.delete(id)
    }
  }
}

export interface CreateSessionInput {
  tokens: TokenResponse
  userId: string
  organizationId: string
  sid: string
  id?: string
  now?: number
}

export function sessionRecordFromTokens({
  tokens,
  userId,
  organizationId,
  sid,
  id,
  now = Date.now(),
}: CreateSessionInput): OidcSessionRecord {
  return {
    id: id ?? crypto.randomUUID(),
    userId,
    organizationId,
    sid,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    accessTokenExpiresAt: tokens.expires_at,
    createdAt: now,
    updatedAt: now,
  }
}

export async function createSession(
  store: OidcSessionStore,
  input: CreateSessionInput
): Promise<OidcSessionRecord> {
  const record = sessionRecordFromTokens(input)
  await store.create(record)
  return record
}

export interface ResolveSessionOptions {
  fetchImpl?: OidcFetch
  now?: number
  /** Refresh this many milliseconds before expiry. Defaults to 30 seconds. */
  refreshSkewMs?: number
}

/**
 * Load a session and refresh it when the access token is near expiry. A failed
 * refresh deletes the local session; the caller should redirect to Copilot.
 */
export async function resolveSession(
  store: OidcSessionStore,
  config: OidcConfig,
  sessionId: string,
  {
    fetchImpl = fetch,
    now = Date.now(),
    refreshSkewMs = 30_000,
  }: ResolveSessionOptions = {}
): Promise<OidcSessionRecord | null> {
  const record = await store.get(sessionId)
  if (!record) return null
  if (record.accessTokenExpiresAt > now + refreshSkewMs) return record
  if (!record.refreshToken) {
    await store.delete(record.id)
    return null
  }

  try {
    const tokens = await refreshAccessToken(config, {
      refreshToken: record.refreshToken,
      fetchImpl,
      now,
    })
    const updated = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? record.refreshToken,
      accessTokenExpiresAt: tokens.expires_at,
      updatedAt: now,
    }
    await store.update(record.id, updated)
    return { ...record, ...updated }
  } catch {
    await store.delete(record.id)
    return null
  }
}

/** Remove every local session bound to a Copilot session id. */
export async function deleteSessionsBySid(
  store: OidcSessionStore,
  sid: string
): Promise<void> {
  await store.deleteBySid(sid)
}

/** The local session id is not the Copilot session id. */
export function isSecureSessionCookie(config: OidcConfig): boolean {
  return normalizeConfig(config).secureCookies
}

import {
  INTERNAL_ROUTES,
  InternalErrorSchema,
  MemberSchema,
  OrganizationSchema,
  EntitlementsSchema,
  UserSchema,
  type Entitlements,
  type IdentityUser,
  type Member,
  type Organization,
} from "../internal/contracts"
import { internalAudience } from "../apps"

/**
 * Typed client for Copilot's identity internal API.
 *
 * The caller supplies a service-token getter so this package does not depend on
 * `@workspace/service-auth` (which depends on contracts). Results are cached
 * briefly; call `invalidate` after a member or role mutation.
 */

export interface IdentityClientOptions {
  /** Copilot origin, e.g. `https://copilot.asynchrone.space`. */
  baseUrl: string
  /** Return a client-credentials token for the requested audience/scopes. */
  getToken: (request: { audience: string; scopes: string[] }) => Promise<string>
  fetchImpl?: typeof fetch
  ttlMs?: number
  now?: () => number
}

export class IdentityClientError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = "IdentityClientError"
    this.code = code
    this.status = status
  }
}

interface CacheEntry {
  value: unknown
  expiresAt: number
}

export class IdentityClient {
  private readonly options: IdentityClientOptions
  private readonly cache = new Map<string, CacheEntry>()
  private readonly audience = internalAudience("copilot")

  constructor(options: IdentityClientOptions) {
    this.options = {
      ttlMs: 30_000,
      fetchImpl: fetch,
      now: Date.now,
      ...options,
    }
  }

  private async token(): Promise<string> {
    return this.options.getToken({
      audience: this.audience,
      scopes: ["internal:identity:read"],
    })
  }

  private async request<T>(
    path: string,
    schema: { parse: (value: unknown) => T },
    init: RequestInit = {}
  ): Promise<T> {
    const now = this.options.now!()
    const cached = this.cache.get(path)
    if (cached && cached.expiresAt > now) return cached.value as T

    const response = await (this.options.fetchImpl ?? fetch)(
      new URL(path, this.options.baseUrl),
      {
        ...init,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${await this.token()}`,
          ...(init.headers ?? {}),
        },
        cache: "no-store",
      }
    )
    const body = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      const parsed = InternalErrorSchema.safeParse(
        typeof body === "object" && body && "error" in body
          ? (body as { error: unknown }).error
          : body
      )
      throw new IdentityClientError(
        parsed.success ? parsed.data.code : "identity_request_failed",
        parsed.success
          ? parsed.data.message
          : `Identity API returned ${response.status}`,
        response.status
      )
    }
    if (!body || typeof body !== "object" || !("data" in body)) {
      throw new IdentityClientError(
        "invalid_response",
        "Identity API response has no data",
        502
      )
    }
    const value = schema.parse((body as { data: unknown }).data)
    this.cache.set(path, {
      value,
      expiresAt: this.options.now!() + (this.options.ttlMs ?? 30_000),
    })
    return value
  }

  getOrganization(id: string): Promise<Organization> {
    return this.request(
      INTERNAL_ROUTES.identityOrganization(encodeURIComponent(id)),
      OrganizationSchema
    )
  }

  listMembers(organizationId: string): Promise<Member[]> {
    return this.request(
      INTERNAL_ROUTES.identityMembers(encodeURIComponent(organizationId)),
      { parse: (value) => MemberSchema.array().parse(value) }
    )
  }

  getUser(id: string): Promise<IdentityUser> {
    return this.request(
      INTERNAL_ROUTES.identityUser(encodeURIComponent(id)),
      UserSchema
    )
  }

  getEntitlements(organizationId: string): Promise<Entitlements> {
    return this.request(
      INTERNAL_ROUTES.identityEntitlements(encodeURIComponent(organizationId)),
      EntitlementsSchema
    )
  }

  /** Drop one path, an organization subtree, or the whole cache. */
  invalidate(scope?: string): void {
    if (!scope) {
      this.cache.clear()
      return
    }
    for (const key of this.cache.keys()) {
      if (key.includes(scope)) this.cache.delete(key)
    }
  }
}

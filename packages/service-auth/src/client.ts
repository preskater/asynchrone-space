import {
  ensureIssuer,
  serviceEndpoint,
  ServiceAuthError,
  type ServiceAuthConfig,
  type ServiceTokenRequest,
} from "./config"

interface CachedToken {
  token: string
  expiresAt: number
}

interface TokenResponse {
  access_token?: unknown
  token_type?: unknown
  expires_in?: unknown
  error?: unknown
  error_description?: unknown
}

/**
 * Client-credentials token cache for one service.
 *
 * Each app has one client; tokens are cached per audience and scope set and
 * refreshed shortly before expiry. Never log the token or the client secret.
 */
export class ServiceTokenClient {
  private readonly cache = new Map<string, CachedToken>()
  private readonly config: ServiceAuthConfig
  private readonly now: () => number
  private readonly skewMs: number

  constructor(
    config: ServiceAuthConfig,
    options: { now?: () => number; skewMs?: number } = {}
  ) {
    this.config = { ...config, issuer: ensureIssuer(config.issuer) }
    this.now = options.now ?? Date.now
    this.skewMs = options.skewMs ?? 30_000
  }

  private key({ audience, scopes }: ServiceTokenRequest): string {
    return `${audience}|${[...scopes].sort().join(" ")}`
  }

  async getToken(request: ServiceTokenRequest): Promise<string> {
    if (request.scopes.length === 0) {
      throw new ServiceAuthError(
        "missing_scope",
        "A service token requires at least one scope",
        400
      )
    }

    const key = this.key(request)
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > this.now() + this.skewMs) {
      return cached.token
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: request.scopes.join(" "),
      resource: request.audience,
    })
    const response = await (this.config.fetchImpl ?? fetch)(
      serviceEndpoint(this.config.issuer, "/oauth2/token"),
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.config.clientId}:${this.config.clientSecret}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
        cache: "no-store",
      }
    )

    const raw = (await response.json().catch(() => ({}))) as TokenResponse
    if (!response.ok || raw.error) {
      throw new ServiceAuthError(
        typeof raw.error === "string" ? raw.error : "token_request_failed",
        typeof raw.error_description === "string"
          ? raw.error_description
          : `Token endpoint returned ${response.status}`,
        response.status
      )
    }
    if (
      typeof raw.access_token !== "string" ||
      typeof raw.expires_in !== "number"
    ) {
      throw new ServiceAuthError(
        "invalid_token_response",
        "Malformed service token response",
        502
      )
    }

    this.cache.set(key, {
      token: raw.access_token,
      expiresAt: this.now() + raw.expires_in * 1000,
    })
    return raw.access_token
  }

  /** Drop a cached token, e.g. after a 401 from the target app. */
  clear(request?: ServiceTokenRequest): void {
    if (request) this.cache.delete(this.key(request))
    else this.cache.clear()
  }
}

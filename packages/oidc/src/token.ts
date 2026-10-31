import { normalizeConfig, oidcEndpoint, type OidcConfig } from "./config"

export type OidcFetch = typeof fetch

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  expires_at: number
  refresh_token?: string
  scope?: string
  id_token?: string
}

export class OidcError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = "OidcError"
    this.code = code
    this.status = status
  }
}

interface RawTokenResponse {
  access_token?: unknown
  token_type?: unknown
  expires_in?: unknown
  refresh_token?: unknown
  scope?: unknown
  id_token?: unknown
  error?: unknown
  error_description?: unknown
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`
}

function normalizeTokenResponse(
  raw: RawTokenResponse,
  now = Date.now()
): TokenResponse {
  if (raw.error) {
    throw new OidcError(
      typeof raw.error === "string" ? raw.error : "oauth_error",
      typeof raw.error_description === "string"
        ? raw.error_description
        : "Token request failed"
    )
  }
  if (
    typeof raw.access_token !== "string" ||
    typeof raw.token_type !== "string" ||
    typeof raw.expires_in !== "number"
  ) {
    throw new OidcError("invalid_token_response", "Malformed token response")
  }
  return {
    access_token: raw.access_token,
    token_type: raw.token_type,
    expires_in: raw.expires_in,
    expires_at: now + raw.expires_in * 1000,
    refresh_token:
      typeof raw.refresh_token === "string" ? raw.refresh_token : undefined,
    scope: typeof raw.scope === "string" ? raw.scope : undefined,
    id_token: typeof raw.id_token === "string" ? raw.id_token : undefined,
  }
}

async function requestToken(
  config: OidcConfig,
  body: URLSearchParams,
  fetchImpl: OidcFetch,
  now = Date.now()
): Promise<TokenResponse> {
  const normalized = normalizeConfig(config)
  const response = await fetchImpl(
    oidcEndpoint(normalized.issuer, "/oauth2/token"),
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(normalized.clientId, normalized.clientSecret),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
    }
  )

  const raw = (await response.json().catch(() => ({}))) as RawTokenResponse
  if (!response.ok) {
    throw new OidcError(
      typeof raw.error === "string" ? raw.error : "token_request_failed",
      typeof raw.error_description === "string"
        ? raw.error_description
        : `Token endpoint returned ${response.status}`,
      response.status
    )
  }
  return normalizeTokenResponse(raw, now)
}

export interface ExchangeCodeInput {
  code: string
  codeVerifier: string
  fetchImpl?: OidcFetch
  now?: number
}

export async function exchangeAuthorizationCode(
  config: OidcConfig,
  { code, codeVerifier, fetchImpl = fetch, now }: ExchangeCodeInput
): Promise<TokenResponse> {
  const normalized = normalizeConfig(config)
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    redirect_uri: normalized.redirectUri,
    resource: normalized.resource,
  })
  return requestToken(normalized, body, fetchImpl, now)
}

export interface RefreshTokenInput {
  refreshToken: string
  fetchImpl?: OidcFetch
  now?: number
}

export async function refreshAccessToken(
  config: OidcConfig,
  { refreshToken, fetchImpl = fetch, now }: RefreshTokenInput
): Promise<TokenResponse> {
  const normalized = normalizeConfig(config)
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    resource: normalized.resource,
  })
  return requestToken(normalized, body, fetchImpl, now)
}

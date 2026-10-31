import { normalizeConfig, type OidcConfig } from "./config"

export interface CookieOptions {
  maxAgeSeconds: number
  secure: boolean
  httpOnly?: boolean
  sameSite?: "Lax" | "Strict" | "None"
  path?: string
}

export function serializeCookie(
  name: string,
  value: string,
  {
    maxAgeSeconds,
    secure,
    httpOnly = true,
    sameSite = "Lax",
    path = "/",
  }: CookieOptions
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
    `SameSite=${sameSite}`,
  ]
  if (httpOnly) parts.push("HttpOnly")
  if (secure) parts.push("Secure")
  return parts.join("; ")
}

export function clearCookie(
  name: string,
  options: Omit<CookieOptions, "maxAgeSeconds">
): string {
  return serializeCookie(name, "", { ...options, maxAgeSeconds: 0 })
}

/** Parse a `Cookie` header into a name -> value map. */
export function parseCookieHeader(
  header: string | null
): Record<string, string> {
  if (!header) return {}
  const cookies: Record<string, string> = {}
  for (const part of header.split(";")) {
    const separator = part.indexOf("=")
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    if (!name) continue
    cookies[name] = decodeURIComponent(part.slice(separator + 1).trim())
  }
  return cookies
}

function prefix(secure: boolean): string {
  return secure ? "__Host-" : ""
}

export function sessionCookieName(config: OidcConfig): string {
  const normalized = normalizeConfig(config)
  return normalized.sessionCookieName
}

export function oauthStateCookieName(config: OidcConfig): string {
  return `${prefix(normalizeConfig(config).secureCookies)}asynchrone_oauth_state`
}

export function oauthVerifierCookieName(config: OidcConfig): string {
  return `${prefix(normalizeConfig(config).secureCookies)}asynchrone_oauth_verifier`
}

export function oauthNonceCookieName(config: OidcConfig): string {
  return `${prefix(normalizeConfig(config).secureCookies)}asynchrone_oauth_nonce`
}

function baseOptions(config: OidcConfig): Omit<CookieOptions, "maxAgeSeconds"> {
  const normalized = normalizeConfig(config)
  return { secure: normalized.secureCookies, httpOnly: true, sameSite: "Lax" }
}

export interface OAuthCookies {
  state: string
  verifier: string
  nonce: string
}

/** Short-lived cookies that hold the state, PKCE verifier and nonce. */
export function serializeOAuthCookies(
  config: OidcConfig,
  values: OAuthCookies,
  maxAgeSeconds = 10 * 60
): string[] {
  const options: CookieOptions = {
    ...baseOptions(config),
    maxAgeSeconds,
  }
  return [
    serializeCookie(oauthStateCookieName(config), values.state, options),
    serializeCookie(oauthVerifierCookieName(config), values.verifier, options),
    serializeCookie(oauthNonceCookieName(config), values.nonce, options),
  ]
}

export function clearOAuthCookies(config: OidcConfig): string[] {
  const options = baseOptions(config)
  return [
    clearCookie(oauthStateCookieName(config), options),
    clearCookie(oauthVerifierCookieName(config), options),
    clearCookie(oauthNonceCookieName(config), options),
  ]
}

export function serializeSessionCookie(
  config: OidcConfig,
  sessionId: string
): string {
  const normalized = normalizeConfig(config)
  return serializeCookie(normalized.sessionCookieName, sessionId, {
    ...baseOptions(config),
    maxAgeSeconds: normalized.sessionMaxAgeSeconds,
  })
}

export function clearSessionCookie(config: OidcConfig): string {
  return clearCookie(
    normalizeConfig(config).sessionCookieName,
    baseOptions(config)
  )
}

/** Read the OIDC cookies from a request. */
export function readOAuthCookies(
  config: OidcConfig,
  cookieHeader: string | null
): Partial<OAuthCookies> {
  const cookies = parseCookieHeader(cookieHeader)
  return {
    state: cookies[oauthStateCookieName(config)],
    verifier: cookies[oauthVerifierCookieName(config)],
    nonce: cookies[oauthNonceCookieName(config)],
  }
}

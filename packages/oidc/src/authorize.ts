import { normalizeConfig, oidcEndpoint, type OidcConfig } from "./config"
import { createPkcePair, createState, randomToken } from "./pkce"

export interface AuthorizationRequestOptions {
  /** Optional `prompt` such as `none`, `login`, `consent` or `select_account`. */
  prompt?: string
  /** Pre-generated state for tests or a retry-safe flow. */
  state?: string
  /** Pre-generated verifier for tests. */
  codeVerifier?: string
}

export interface AuthorizationRequest {
  url: string
  state: string
  codeVerifier: string
  nonce: string
}

/** Build an authorization-code + PKCE redirect for a first-party app. */
export function createAuthorizationRequest(
  config: OidcConfig,
  options: AuthorizationRequestOptions = {}
): AuthorizationRequest {
  const normalized = normalizeConfig(config)
  const state = options.state ?? createState()
  const pkce = createPkcePair(options.codeVerifier)
  const nonce = randomToken(16)

  const url = new URL(oidcEndpoint(normalized.issuer, "/oauth2/authorize"))
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", normalized.clientId)
  url.searchParams.set("redirect_uri", normalized.redirectUri)
  url.searchParams.set("scope", normalized.scopes.join(" "))
  url.searchParams.set("resource", normalized.resource)
  url.searchParams.set("state", state)
  url.searchParams.set("nonce", nonce)
  url.searchParams.set("code_challenge", pkce.challenge)
  url.searchParams.set("code_challenge_method", pkce.method)
  if (options.prompt) url.searchParams.set("prompt", options.prompt)

  return { url: url.toString(), state, codeVerifier: pkce.verifier, nonce }
}

import { normalizeConfig, oidcEndpoint, type OidcConfig } from "./config"
import { verifyLogoutToken, type LogoutTokenClaims } from "./jwks"
import { deleteSessionsBySid, type OidcSessionStore } from "./session"

/**
 * Handle an OIDC back-channel logout token: verify it against Copilot's JWKS
 * and delete every local session bound to the token's `sid`.
 */
export async function handleBackChannelLogout(
  config: OidcConfig,
  store: OidcSessionStore,
  logoutToken: string,
  verify: (token: string) => Promise<LogoutTokenClaims> = (token) =>
    verifyLogoutToken(config, token)
): Promise<{ sid: string }> {
  const claims = await verify(logoutToken)
  const sid = claims.sid
  if (!sid) throw new Error("Logout token has no session id")
  await deleteSessionsBySid(store, sid)
  return { sid }
}

export interface EndSessionOptions {
  /** Optional `id_token_hint`; required for a verified immediate logout. */
  idToken?: string
  /** Must exactly match a URI registered on the client. */
  postLogoutRedirectUri?: string
  state?: string
}

/** Build the RP-initiated logout URL at Copilot. */
export function buildEndSessionUrl(
  config: OidcConfig,
  options: EndSessionOptions = {}
): string {
  const normalized = normalizeConfig(config)
  const url = new URL(oidcEndpoint(normalized.issuer, "/oauth2/end-session"))
  if (options.idToken) url.searchParams.set("id_token_hint", options.idToken)
  if (options.postLogoutRedirectUri) {
    url.searchParams.set(
      "post_logout_redirect_uri",
      options.postLogoutRedirectUri
    )
  }
  if (options.state) url.searchParams.set("state", options.state)
  url.searchParams.set("client_id", normalized.clientId)
  return url.toString()
}

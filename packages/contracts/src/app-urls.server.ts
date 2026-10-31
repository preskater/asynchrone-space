import {
  APP_KEYS,
  APPS,
  CUSTOMER_APP_KEYS,
  isAppKey,
  type AppKey,
} from "./apps"
import { APP_USER_SCOPES } from "./oauth"

/**
 * Runtime app origins.
 *
 * Import this module only from server code (route handlers, server components,
 * server actions). The public landing page never needs the customer session,
 * so a client component should receive any cross-app URL as a server-rendered
 * prop instead of reading `process.env` itself.
 */

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

/**
 * Public origin of an app.
 *
 * The environment variable wins; the local development port is the fallback.
 * A production deployment must set the variable, which the deployment checks
 * in #183/#192 will enforce.
 */
export function appOrigin(key: AppKey): string {
  const definition = APPS[key]
  const configured = process.env[definition.hostEnv]
  return trimTrailingSlash(configured || definition.devUrl)
}

export interface AppUrlOptions {
  locale?: string
  orgSlug?: string
  path?: string
}

/** Absolute URL to a page in another app. */
export function appUrl(key: AppKey, options: AppUrlOptions = {}): string {
  const segments: string[] = []
  if (options.locale) segments.push(options.locale)
  if (options.orgSlug) segments.push(options.orgSlug)

  const path = options.path ?? ""
  if (path) {
    if (!path.startsWith("/")) throw new Error("appUrl path must start with /")
    segments.push(path)
  } else if (segments.length > 0) {
    segments.push("")
  }

  const suffix = segments
    .map((segment) => (segment === "" ? "" : segment.replace(/^\/+|\/+$/g, "")))
    .filter(Boolean)
    .join("/")

  return suffix ? `${appOrigin(key)}/${suffix}` : appOrigin(key)
}

/**
 * OAuth resources for the workspace apps that receive user-delegated tokens.
 * Copilot is the authorization server and does not need a token for itself;
 * the landing and control tower have their own surfaces.
 */
export interface AppOAuthResource {
  identifier: string
  allowedScopes: string[]
}

export function appOAuthResources(): AppOAuthResource[] {
  return CUSTOMER_APP_KEYS.filter((key) => key !== "copilot").map((key) => ({
    identifier: appOrigin(key),
    allowedScopes: [...APP_USER_SCOPES],
  }))
}

/** User-delegated scopes requested by a first-party app. */
export function appOAuthScopes(): string[] {
  return [...APP_USER_SCOPES]
}

/**
 * Origins allowed to call Copilot's auth endpoints (OAuth redirects and server
 * actions). The landing and the control tower are deliberately excluded: the
 * landing has no session and the control tower has its own auth.
 */
export function trustedCustomerOrigins(): string[] {
  return CUSTOMER_APP_KEYS.map((key) => appOrigin(key))
}

/** Origin used by the landing/marketing CTA and by server-rendered links. */
export function workspaceOrigin(): string {
  return appOrigin("copilot")
}

/** All configured origins, including the landing and control tower. */
export function allAppOrigins(): Record<AppKey, string> {
  return Object.fromEntries(
    APP_KEYS.map((key) => [key, appOrigin(key)])
  ) as Record<AppKey, string>
}

export { appDefinition, databaseName, internalAudience, isAppKey } from "./apps"
export type { AppKey, AppDefinition } from "./apps"

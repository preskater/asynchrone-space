/**
 * User-delegated OAuth scopes for workspace apps.
 *
 * Resource audiences already restrict a token to one app. These scopes are the
 * minimum read/write distinction; the target app still applies organization
 * role, entitlement and row-level checks.
 */
export const APP_USER_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "app:read",
  "app:write",
] as const

export type AppUserScope = (typeof APP_USER_SCOPES)[number]

/** The scopes requested by a first-party workspace app. */
export const APP_USER_SCOPE_STRING = APP_USER_SCOPES.join(" ")

import "./load-env"

import { authConfig } from "../lib/auth"

/**
 * Guards the session-cookie decision recorded in ADR 0018.
 *
 * The control tower must never share a cookie domain with the customer app:
 * `Domain=.asynchrone.space` would ship the admin session to every subdomain (including
 * vendor hosts) and allow cookie tossing. This check fails the build if someone
 * enables cross-subdomain cookies later.
 */

const failures: string[] = []

function check(condition: unknown, message: string) {
  if (condition) {
    console.log(`✓ ${message}`)
    return
  }
  failures.push(message)
  console.error(`✗ ${message}`)
}

check(
  !(
    authConfig.advanced as
      { crossSubDomainCookies?: { enabled?: boolean } } | undefined
  )?.crossSubDomainCookies?.enabled,
  "cross-subdomain cookies are disabled"
)
check(
  authConfig.advanced?.cookiePrefix === "asynchrone-space-control-tower",
  "the session cookie prefix is scoped to this app"
)
check(
  authConfig.emailAndPassword?.disableSignUp === true,
  "public sign-up is disabled"
)
check(
  authConfig.session?.expiresIn === 4 * 60 * 60,
  "platform sessions expire after 4 hours"
)
check(
  Array.isArray(authConfig.trustedOrigins) &&
    authConfig.trustedOrigins.length === 1,
  "only this app's origin is trusted"
)
check(
  authConfig.plugins?.some(
    (plugin) => (plugin as { id?: string }).id === "two-factor"
  ),
  "two-factor authentication is available"
)
check(
  authConfig.secret === process.env.CONTROL_TOWER_BETTER_AUTH_SECRET,
  "uses CONTROL_TOWER_BETTER_AUTH_SECRET"
)
if (process.env.BETTER_AUTH_SECRET) {
  check(
    authConfig.secret !== process.env.BETTER_AUTH_SECRET,
    "does not reuse the customer app's BETTER_AUTH_SECRET"
  )
}

if (failures.length > 0) {
  console.error(`\n${failures.length} auth configuration check(s) failed.`)
  process.exit(1)
}

console.log("\nAuth configuration is safe.")

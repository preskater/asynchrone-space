import { IdentityAdminClient } from "@workspace/contracts"
import { ServiceTokenClient } from "@workspace/service-auth"

let client: IdentityAdminClient | null = null

/**
 * Control-tower client for Copilot's identity admin API.
 *
 * The control tower never reads the identity database directly. It obtains a
 * client-credentials token for the Copilot audience and performs the mutation
 * through `/internal/v1/admin/*`; the platform audit event stays in this app's
 * own database.
 */
export function identityAdmin(): IdentityAdminClient {
  if (client) return client
  const issuer = process.env.PLATFORM_APP_URL
  const clientId = process.env.CONTROL_TOWER_OAUTH_CLIENT_ID
  const clientSecret = process.env.CONTROL_TOWER_OAUTH_CLIENT_SECRET
  if (!issuer || !clientId || !clientSecret) {
    throw new Error(
      "PLATFORM_APP_URL, CONTROL_TOWER_OAUTH_CLIENT_ID and CONTROL_TOWER_OAUTH_CLIENT_SECRET are required"
    )
  }
  const tokens = new ServiceTokenClient({ issuer, clientId, clientSecret })
  client = new IdentityAdminClient({
    baseUrl: issuer,
    getToken: (request) => tokens.getToken(request),
  })
  return client
}

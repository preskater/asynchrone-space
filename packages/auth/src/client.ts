import { createAuthClient } from "better-auth/react"
import { organizationClient } from "better-auth/client/plugins"
import { oauthProviderClient } from "@better-auth/oauth-provider/client"

import { ac, orgRoles } from "@workspace/organization"

export function createCustomerAuthClient(baseURL?: string) {
  return createAuthClient({
    ...(baseURL ? { baseURL } : {}),
    plugins: [
      organizationClient({
        ac,
        roles: orgRoles,
      }),
      oauthProviderClient(),
    ],
  })
}

/** Shell auth client: same-origin `/api/auth` on apps/web. */
export const authClient = createCustomerAuthClient()

import { createAuthClient } from "better-auth/react"
import { twoFactorClient } from "better-auth/client/plugins"

/**
 * Same-origin client: the control tower's own cookie is the only credential
 * involved. It is never shared with the customer app (ADR 0018).
 */
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
})

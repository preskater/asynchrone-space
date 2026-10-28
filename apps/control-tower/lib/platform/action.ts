import type { PlatformContext } from "./guard"
import { requirePlatformContext } from "./guard"

/**
 * Wraps a server action: authenticates the platform context, runs the action
 * and lets the caller append its audit event. Mutations are added in a later
 * phase; this exists now so the contract is in one place.
 */
export async function withPlatformAction<T>(
  fn: (ctx: PlatformContext) => Promise<T>
): Promise<T> {
  const ctx = await requirePlatformContext({ surface: "action" })
  return fn(ctx)
}

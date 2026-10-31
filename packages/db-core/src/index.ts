import { Pool } from "pg"

/**
 * Shared PostgreSQL pool for the per-app database packages.
 *
 * Each app owns one database and one pool. A per-app package passes its own
 * connection string and label; `DATABASE_POOL_MAX` is still the global budget
 * knob. Prisma adapters use the pool with `disposeExternalPool: false` so the
 * large-object helpers and Prisma share one connection set.
 */

export function poolMax(
  value = process.env.DATABASE_POOL_MAX,
  fallback = 3
): number {
  const parsed = Number(value)
  if (Number.isInteger(parsed) && parsed > 0) return parsed
  return fallback
}

export interface CreatePoolOptions {
  max?: number
  label?: string
}

export function createPool(
  connectionString: string | undefined,
  options: CreatePoolOptions = {}
): Pool {
  if (!connectionString) {
    throw new Error(
      `${options.label ?? "DATABASE_URL"} is required for the database connection`
    )
  }
  return new Pool({
    connectionString,
    max: options.max ?? poolMax(),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  })
}

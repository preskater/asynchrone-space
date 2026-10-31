import { AppError, type ErrorCode } from "./errors"

/**
 * Fixed-window rate limiter shared by every replica through the `rateLimit`
 * table (the same one Better Auth uses for its auth endpoints).
 *
 * Better Auth prunes rows older than its longest configured window (1 h, see
 * `lib/auth.ts`); keep app windows at or below that so a row is never pruned
 * while its window is still open.
 *
 * The package is database-agnostic: the app supplies the query function, which
 * lets a domain app use its own database without importing a shared client.
 */
export const MAX_WINDOW_MS = 60 * 60 * 1000

export type RateLimitQuery = <T>(
  query: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T>

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the window resets; 0 when allowed. */
  retryAfter: number
}

export interface RateLimitOptions {
  /**
   * What to do when the store is unreachable. Use `true` for cosmetic limits
   * (feedback, uploads); keep `false` for anything that spends money or sends
   * email on the caller's behalf.
   */
  failOpen: boolean
}

export interface RateLimiter {
  rateLimit: (
    key: string,
    limit: number,
    windowMs: number,
    options: RateLimitOptions
  ) => Promise<RateLimitResult>
  assertRateLimit: (
    key: string,
    limit: number,
    windowMs: number,
    options: RateLimitOptions & { code?: ErrorCode; message?: string }
  ) => Promise<void>
}

/** Build a limiter over the caller's `rateLimit` table. */
export function createRateLimiter(queryRaw: RateLimitQuery): RateLimiter {
  async function rateLimit(
    key: string,
    limit: number,
    windowMs: number,
    { failOpen }: RateLimitOptions
  ): Promise<RateLimitResult> {
    if (windowMs > MAX_WINDOW_MS) {
      throw new Error(`rateLimit window for ${key} exceeds ${MAX_WINDOW_MS}ms`)
    }
    const now = Date.now()
    try {
      // One atomic upsert: a new key or an expired window restarts at 1.
      const [row] = await queryRaw<{ count: number; lastRequest: bigint }[]>`
        INSERT INTO "rateLimit" ("id", "key", "count", "lastRequest")
        VALUES (gen_random_uuid()::text, ${`app:${key}`}, 1, ${now}::bigint)
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "rateLimit"."lastRequest" <= ${now - windowMs}::bigint
            THEN 1 ELSE "rateLimit"."count" + 1 END,
          "lastRequest" = CASE WHEN "rateLimit"."lastRequest" <= ${now - windowMs}::bigint
            THEN ${now}::bigint ELSE "rateLimit"."lastRequest" END
        RETURNING "count", "lastRequest"
      `
      if (row!.count <= limit) return { allowed: true, retryAfter: 0 }
      const resetAt = Number(row!.lastRequest) + windowMs
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      }
    } catch (error) {
      console.error(`[rate-limit] store unavailable for ${key}`, error)
      return failOpen
        ? { allowed: true, retryAfter: 0 }
        : { allowed: false, retryAfter: Math.ceil(windowMs / 1000) }
    }
  }

  /** Throws a 429 `AppError` (with `Retry-After`) once `key` is over its limit. */
  async function assertRateLimit(
    key: string,
    limit: number,
    windowMs: number,
    options: RateLimitOptions & { code?: ErrorCode; message?: string }
  ): Promise<void> {
    const { allowed, retryAfter } = await rateLimit(
      key,
      limit,
      windowMs,
      options
    )
    if (allowed) return
    throw new AppError(
      options.code ?? "rate_limited",
      options.message ?? "Too many requests. Try again in a few minutes.",
      { status: 429, retryAfter }
    )
  }

  return { rateLimit, assertRateLimit }
}

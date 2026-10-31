import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppError } from "./errors"
import { createRateLimiter, MAX_WINDOW_MS } from "./rate-limit"

const queryRaw = vi.fn()
const { assertRateLimit, rateLimit } = createRateLimiter(queryRaw)

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("rateLimit", () => {
  it("allows up to the limit and reports the remaining window after it", async () => {
    const start = BigInt(Date.now() - 20_000)
    queryRaw.mockResolvedValueOnce([{ count: 3, lastRequest: start }])
    expect(await rateLimit("k", 3, 60_000, { failOpen: false })).toEqual({
      allowed: true,
      retryAfter: 0,
    })

    queryRaw.mockResolvedValueOnce([{ count: 4, lastRequest: start }])
    const denied = await rateLimit("k", 3, 60_000, { failOpen: false })
    expect(denied.allowed).toBe(false)
    expect(denied.retryAfter).toBeGreaterThanOrEqual(39)
    expect(denied.retryAfter).toBeLessThanOrEqual(40)
  })

  it("namespaces keys away from Better Auth's ip|path rows", async () => {
    queryRaw.mockResolvedValueOnce([{ count: 1, lastRequest: 0n }])
    await rateLimit("feedback:u1", 1, 1000, { failOpen: true })
    expect(queryRaw.mock.calls[0]).toContain("app:feedback:u1")
  })

  it("fails open or closed as the call site asks when the store is down", async () => {
    queryRaw.mockRejectedValue(new Error("db down"))
    expect((await rateLimit("k", 1, 60_000, { failOpen: true })).allowed).toBe(
      true
    )
    expect(await rateLimit("k", 1, 60_000, { failOpen: false })).toEqual({
      allowed: false,
      retryAfter: 60,
    })
  })

  it("refuses windows Better Auth could prune early", async () => {
    await expect(
      rateLimit("k", 1, MAX_WINDOW_MS + 1, { failOpen: true })
    ).rejects.toThrow()
  })
})

describe("assertRateLimit", () => {
  it("throws a 429 carrying Retry-After", async () => {
    queryRaw.mockResolvedValueOnce([
      { count: 2, lastRequest: BigInt(Date.now()) },
    ])
    const error = await assertRateLimit("k", 1, 30_000, {
      failOpen: false,
    }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(AppError)
    expect(error).toMatchObject({ status: 429, code: "rate_limited" })
    expect((error as AppError).retryAfter).toBeGreaterThan(0)
  })
})

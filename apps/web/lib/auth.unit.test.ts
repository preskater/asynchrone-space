import { beforeAll, describe, expect, it, vi } from "vitest"

const { sendResetPasswordEmail, sendVerificationEmail } = vi.hoisted(() => ({
  sendResetPasswordEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}))

vi.mock("./email", () => ({ sendResetPasswordEmail, sendVerificationEmail }))

beforeAll(() => {
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test"
  process.env.BETTER_AUTH_SECRET = "unit-test-secret-at-least-16-chars"
  process.env.BETTER_AUTH_URL = "http://localhost:3000"
  delete process.env.REQUIRE_EMAIL_VERIFICATION
})

describe("auth email configuration", () => {
  it("wires password reset and email verification to the mailer", async () => {
    const { auth } = await import("./auth")
    const emailAndPassword = auth.options.emailAndPassword!
    const emailVerification = auth.options.emailVerification!

    expect(emailAndPassword.sendResetPassword).toBeTypeOf("function")
    expect(emailVerification.sendVerificationEmail).toBeTypeOf("function")

    await emailAndPassword.sendResetPassword!({
      user: { email: "user@example.com" } as never,
      url: "https://app.example.com/reset",
      token: "reset-token",
    })
    expect(sendResetPasswordEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      url: "https://app.example.com/reset",
    })

    await emailVerification.sendVerificationEmail!({
      user: { email: "user@example.com" } as never,
      url: "https://app.example.com/verify",
      token: "verify-token",
    })
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      url: "https://app.example.com/verify",
    })
  })
})

describe("auth rate limiting", () => {
  it("shares counters through the database and outlives app windows", async () => {
    const { auth } = await import("./auth")
    const { MAX_WINDOW_MS } = await import("./core/rate-limit")
    const rateLimit = auth.options.rateLimit!
    expect(rateLimit.storage).toBe("database")
    // Better Auth prunes rows older than its longest window; app rows in the
    // same table must never outlive it.
    const longest = Math.max(
      ...Object.values(rateLimit.customRules ?? {}).map((rule) =>
        rule && typeof rule === "object" ? rule.window : 0
      )
    )
    expect(longest * 1000).toBeGreaterThanOrEqual(MAX_WINDOW_MS)
  })
})

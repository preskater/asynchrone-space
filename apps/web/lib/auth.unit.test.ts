import { beforeAll, describe, expect, it, vi } from "vitest"

const { sendResetPasswordEmail, sendVerificationEmail } = vi.hoisted(() => ({
  sendResetPasswordEmail: vi.fn(),
  sendVerificationEmail: vi.fn(),
}))

vi.mock("@workspace/core/server", () => ({
  sendResetPasswordEmail,
  sendVerificationEmail,
}))

// The MCP plugin seeds OAuth resources at init; replace it with an inert plugin
// so the unit test never connects to a database.
vi.mock("@better-auth/mcp", () => ({
  mcp: () => ({ id: "mcp-test" }),
}))
vi.mock("@better-auth/cimd", () => ({
  cimd: () => ({ id: "cimd-test" }),
}))
vi.mock("@better-auth/cimd/node", () => ({
  fetchClientMetadataResource: async () => null,
}))

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

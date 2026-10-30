import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { twoFactorAuditAction } from "./two-factor-audit"

describe("twoFactorAuditAction", () => {
  it("logs enrollment on the first verified code", () => {
    expect(twoFactorAuditAction("/two-factor/verify-totp")).toBe(
      "member.two_factor_enabled"
    )
  })

  it("logs disabling", () => {
    expect(twoFactorAuditAction("/two-factor/disable")).toBe(
      "member.two_factor_disabled"
    )
  })

  it("ignores other user updates", () => {
    expect(twoFactorAuditAction("/update-user")).toBeNull()
    expect(twoFactorAuditAction("/two-factor/verify-backup-code")).toBeNull()
    expect(twoFactorAuditAction(undefined)).toBeNull()
  })
})

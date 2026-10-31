import { describe, expect, it } from "vitest"

import { safeRedirect } from "./redirect"

describe("safeRedirect", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeRedirect("/projects")).toBe("/projects")
    expect(safeRedirect("/projects?x=1#y")).toBe("/projects?x=1#y")
  })

  it("rejects absolute, protocol-relative and backslash tricks", () => {
    expect(safeRedirect("https://evil.com")).toBe("/onboarding")
    expect(safeRedirect("//evil.com")).toBe("/onboarding")
    expect(safeRedirect("/\\evil.com")).toBe("/onboarding")
    expect(safeRedirect("javascript:alert(1)")).toBe("/onboarding")
    expect(safeRedirect(undefined)).toBe("/onboarding")
    expect(safeRedirect(null)).toBe("/onboarding")
  })

  it("honours a custom fallback", () => {
    expect(safeRedirect("https://evil.com", "/portal")).toBe("/portal")
  })
})

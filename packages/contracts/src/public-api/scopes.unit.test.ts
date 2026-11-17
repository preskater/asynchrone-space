import { describe, expect, it } from "vitest"

import {
  hasPublicApiScope,
  isPublicApiScope,
  PUBLIC_API_SCOPE_VALUES,
  PUBLIC_API_SCOPES,
} from "./scopes"

describe("public API scopes", () => {
  it("publishes a stable, non-empty catalogue", () => {
    expect(PUBLIC_API_SCOPE_VALUES).toContain("projects:read")
    expect(PUBLIC_API_SCOPE_VALUES).toContain("files:read")
    expect(new Set(PUBLIC_API_SCOPE_VALUES).size).toBe(
      PUBLIC_API_SCOPE_VALUES.length
    )
  })

  it("recognises only catalogue values", () => {
    expect(isPublicApiScope(PUBLIC_API_SCOPES.tasksWrite)).toBe(true)
    expect(isPublicApiScope("projects:admin")).toBe(false)
    expect(isPublicApiScope("")).toBe(false)
  })

  it("checks a token's scopes", () => {
    expect(
      hasPublicApiScope(["projects:read", "tasks:read"], "tasks:read")
    ).toBe(true)
    expect(hasPublicApiScope(["projects:read"], "projects:write")).toBe(false)
  })
})

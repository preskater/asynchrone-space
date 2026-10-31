import { describe, expect, it } from "vitest"

import {
  SERVICE_SCOPES,
  assertAudience,
  hasScope,
  parseServiceTokenClaims,
  scopeSet,
  serviceScopeSchema,
} from "./auth"

const claims = {
  iss: "https://copilot.asynchrone.space",
  sub: "projects",
  aud: "urn:asynchrone:app:projects",
  scope: `${SERVICE_SCOPES.identityRead} ${SERVICE_SCOPES.searchRead}`,
  exp: 1_900_000_000,
  client_id: "projects",
}

describe("service authentication", () => {
  it("parses space-separated scopes", () => {
    expect(scopeSet("a b  c")).toEqual(new Set(["a", "b", "c"]))
  })

  it("checks a required scope", () => {
    const parsed = parseServiceTokenClaims(claims)
    expect(hasScope(parsed, SERVICE_SCOPES.identityRead)).toBe(true)
    expect(hasScope(parsed, SERVICE_SCOPES.deleteWrite)).toBe(false)
  })

  it("rejects a token for another audience", () => {
    const parsed = parseServiceTokenClaims(claims)
    expect(() => assertAudience(parsed, "urn:asynchrone:app:files")).toThrow(
      "Service token audience mismatch"
    )
  })

  it("accepts only known service scopes", () => {
    expect(serviceScopeSchema.parse(SERVICE_SCOPES.auditRead)).toBe(
      SERVICE_SCOPES.auditRead
    )
    expect(() => serviceScopeSchema.parse("internal:superuser")).toThrow()
  })
})

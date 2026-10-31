import { describe, expect, it } from "vitest"

import {
  codeChallenge,
  createPkcePair,
  createState,
  stateMatches,
} from "./pkce"

describe("PKCE", () => {
  it("matches the RFC 7636 S256 example", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    expect(codeChallenge(verifier)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    )
  })

  it("creates a verifier in the RFC length range", () => {
    const pair = createPkcePair()
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43)
    expect(pair.verifier.length).toBeLessThanOrEqual(128)
    expect(pair.challenge).toBe(codeChallenge(pair.verifier))
    expect(pair.method).toBe("S256")
  })

  it("rejects a short verifier", () => {
    expect(() => createPkcePair("too-short")).toThrow()
  })

  it("creates random state and compares it in constant time", () => {
    const state = createState()
    expect(stateMatches(state, state)).toBe(true)
    expect(stateMatches(state, createState())).toBe(false)
    expect(stateMatches(state, null)).toBe(false)
  })
})

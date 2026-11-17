import { describe, expect, it } from "vitest"

import {
  API_TOKEN_PREFIX,
  generateApiToken,
  hashApiToken,
  tokenDisplayPrefix,
} from "./tokens"

describe("public API tokens", () => {
  it("generates async_ tokens with 32 random bytes", () => {
    const token = generateApiToken()
    expect(token.startsWith(API_TOKEN_PREFIX)).toBe(true)
    expect(token.slice(API_TOKEN_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateApiToken()).not.toBe(token)
  })

  it("hashes deterministically without keeping the raw value", () => {
    const token = generateApiToken()
    const hash = hashApiToken(token)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hashApiToken(token)).toBe(hash)
    expect(hash).not.toContain(token)
  })

  it("exposes only a short display prefix", () => {
    const token = "async_abcdefghijklmnop"
    expect(tokenDisplayPrefix(token)).toBe("async_abcdef")
    expect(tokenDisplayPrefix(token)).toHaveLength(12)
  })
})

import { beforeEach, describe, expect, it } from "vitest"

import { decryptSecret, encryptSecret, generateWebhookSecret } from "./crypto"

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET =
    "test-secret-at-least-32-characters-long-for-crypto"
})

describe("secret encryption", () => {
  it("round-trips within the same purpose", () => {
    const value = encryptSecret("hello", "webhook-secret")
    expect(decryptSecret(value, "webhook-secret")).toBe("hello")
  })

  it("keeps the repository-token default", () => {
    const value = encryptSecret("hello")
    expect(decryptSecret(value)).toBe("hello")
  })

  it("cannot decrypt a ciphertext from another purpose", () => {
    const value = encryptSecret("hello", "webhook-secret")
    expect(() => decryptSecret(value, "repository-token")).toThrow()
  })

  it("generates distinct, URL-safe webhook secrets", () => {
    const first = generateWebhookSecret()
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateWebhookSecret()).not.toBe(first)
  })
})

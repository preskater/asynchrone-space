import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

/** RFC 7636 S256 PKCE pair. */
export interface PkcePair {
  verifier: string
  challenge: string
  method: "S256"
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

export function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

export function createPkcePair(verifier = randomToken(32)): PkcePair {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) {
    throw new Error("PKCE verifier must be 43-128 unreserved characters")
  }
  return { verifier, challenge: codeChallenge(verifier), method: "S256" }
}

export function createState(): string {
  return randomToken(32)
}

/** Constant-time comparison for the OAuth state value. */
export function stateMatches(expected: string, actual: string | null): boolean {
  if (!actual) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(actual)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

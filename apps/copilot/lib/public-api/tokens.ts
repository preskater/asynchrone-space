import { createHash, randomBytes } from "node:crypto"

/**
 * Public API token format: `async_` plus 32 random bytes in base64url.
 * The raw value is returned once at creation; only its SHA-256 hash is stored.
 */
export const API_TOKEN_PREFIX = "async_"
const TOKEN_BYTES = 32
/** `async_` plus enough random characters to identify a token in settings. */
export const API_TOKEN_DISPLAY_PREFIX_LENGTH = 12

export function generateApiToken(): string {
  return `${API_TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`
}

export function hashApiToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex")
}

/** The visible, non-secret part stored beside the hash. */
export function tokenDisplayPrefix(raw: string): string {
  return raw.slice(0, API_TOKEN_DISPLAY_PREFIX_LENGTH)
}

/** Audit actor id for a request made with this token. */
export function apiTokenActorId(tokenId: string): string {
  return `api-token:${tokenId}`
}

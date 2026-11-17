import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto"

/**
 * Symmetric encryption for repository access tokens and webhook secrets.
 *
 * Secrets are encrypted with AES-256-GCM using a key derived from
 * `BETTER_AUTH_SECRET` and a purpose string, so a ciphertext from one purpose
 * cannot be decrypted with another. The format is `v1:<iv>:<tag>:<ciphertext>`
 * with base64url parts, so the scheme can evolve without losing old values.
 *
 * Rotating `BETTER_AUTH_SECRET` invalidates stored secrets: repository
 * connections must be re-authenticated and webhook secrets must be rotated.
 */
const VERSION = "v1"
const DEFAULT_PURPOSE = "repository-token"

function deriveKey(purpose: string): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) {
    throw new Error(
      "BETTER_AUTH_SECRET is required to encrypt stored credentials."
    )
  }
  return createHash("sha256")
    .update(`asynchrone-space:${purpose}:${secret}`)
    .digest()
}

export function encryptSecret(
  plaintext: string,
  purpose = DEFAULT_PURPOSE
): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", deriveKey(purpose), iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":")
}

export function decryptSecret(
  value: string,
  purpose = DEFAULT_PURPOSE
): string {
  const [version, iv, tag, data] = value.split(":")
  if (version !== VERSION || !iv || !tag || !data) {
    throw new Error("Unsupported secret format.")
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveKey(purpose),
    Buffer.from(iv, "base64url")
  )
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

/** Random URL-safe secret used for webhook HMACs / GitLab webhook tokens. */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString("base64url")
}

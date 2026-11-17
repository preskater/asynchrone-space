import {
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
} from "@workspace/integrations"

/**
 * Webhook secrets use their own key derivation context, so a repository
 * token ciphertext can never be decrypted as a webhook secret or vice versa.
 */
const PURPOSE = "webhook-secret"

export function generateWebhookSigningSecret(): string {
  return generateWebhookSecret()
}

export function encryptWebhookSecret(secret: string): string {
  return encryptSecret(secret, PURPOSE)
}

export function decryptWebhookSecret(value: string): string {
  return decryptSecret(value, PURPOSE)
}

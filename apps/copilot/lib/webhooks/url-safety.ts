import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

import { ValidationError } from "@workspace/core/errors"

type LookupResult = { address: string; family: number }
type Resolver = (
  hostname: string,
  options: { all: true }
) => Promise<LookupResult[]>

function privateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number)
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true
  }
  const [a, b] = parts as [number, number, number, number]
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0)
  )
}

function privateIpv6(address: string): boolean {
  const value = address.toLowerCase()
  if (value === "::" || value === "::1") return true
  if (value.startsWith("::ffff:")) {
    return privateIpv4(value.slice("::ffff:".length))
  }
  // fc00::/7 unique-local, fe80::/10 link-local, ff00::/8 multicast,
  // 2001:db8::/32 documentation.
  return (
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    /^fe[89ab]/.test(value) ||
    value.startsWith("ff") ||
    value.startsWith("2001:db8")
  )
}

export function isPrivateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return privateIpv4(address)
  if (family === 6) return privateIpv6(address)
  return true
}

/**
 * Rejects webhook targets that could reach the cluster or a local network.
 * The dispatcher re-checks the resolved address at delivery time (DNS can
 * change between subscription creation and a later retry).
 */
export async function assertSafeWebhookUrl(
  raw: string,
  resolve: Resolver = lookup as unknown as Resolver
): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ValidationError("Enter a valid webhook URL.")
  }
  if (url.protocol !== "https:") {
    throw new ValidationError("Webhook endpoints must use HTTPS.")
  }
  if (url.username || url.password) {
    throw new ValidationError("Webhook URLs cannot include credentials.")
  }
  if (url.hash) {
    throw new ValidationError("Webhook URLs cannot include a fragment.")
  }

  const host = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase()
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    throw new ValidationError("Webhook endpoints cannot target a local host.")
  }
  if (isIP(host) !== 0) {
    if (isPrivateAddress(host)) {
      throw new ValidationError(
        "Webhook endpoints cannot target a private address."
      )
    }
    return url
  }

  let addresses: LookupResult[]
  try {
    addresses = await resolve(host, { all: true })
  } catch {
    throw new ValidationError("The webhook host could not be resolved.")
  }
  if (addresses.length === 0) {
    throw new ValidationError("The webhook host could not be resolved.")
  }
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new ValidationError("The webhook host resolves to a private address.")
  }
  return url
}

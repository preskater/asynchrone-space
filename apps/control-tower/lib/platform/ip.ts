/**
 * Optional network allowlist for the control tower.
 *
 * Supports exact IPv4 addresses, IPv4 CIDR blocks and `*`. IPv6 addresses are
 * matched exactly. Requests without a matching address are rejected; an empty
 * or unset list allows every address (rely on the in-app auth and, ideally, an
 * access proxy in front of the app).
 */
export function isIpAllowed(
  ip: string | null,
  allowlist: string | undefined
): boolean {
  const entries = (allowlist ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (entries.length === 0) return true
  if (!ip) return false

  const address = normalize(ip)
  return entries.some((entry) => matches(address, entry))
}

function normalize(ip: string): string {
  return ip.trim().replace(/^::ffff:/, "")
}

function matches(address: string, entry: string): boolean {
  if (entry === "*") return true
  if (entry.includes("/")) {
    const [network, bitsRaw] = entry.split("/")
    const bits = Number(bitsRaw)
    if (!network || !Number.isInteger(bits) || bits < 0 || bits > 32) {
      return false
    }
    const value = ipv4ToInt(address)
    const base = ipv4ToInt(network)
    if (value === null || base === null) return false
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) === (base & mask)
  }
  return address === normalize(entry)
}

function ipv4ToInt(value: string): number | null {
  const parts = value.split(".")
  if (parts.length !== 4) return null
  let result = 0
  for (const part of parts) {
    const octet = Number(part)
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null
    result = (result << 8) + octet
  }
  return result >>> 0
}

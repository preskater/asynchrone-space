/**
 * Resolve a user-supplied `?redirect=` target to a safe, same-origin path.
 *
 * Only relative paths are allowed; absolute URLs, protocol-relative URLs
 * (`//evil.com`) and backslash tricks (`/\evil.com`) fall back to `fallback`.
 */
export function safeRedirect(
  value: string | null | undefined,
  fallback = "/onboarding"
): string {
  if (!value) return fallback
  if (!value.startsWith("/") || value.startsWith("//")) return fallback
  try {
    const url = new URL(value, "https://local.invalid")
    if (url.origin !== "https://local.invalid") return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

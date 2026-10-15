/**
 * Best-effort per-instance rate limiter.
 *
 * This is a stopgap for beta: on serverless platforms each instance keeps its
 * own map, so limits are approximate. For a shared limit use the platform WAF
 * or an external store (e.g. Upstash Redis).
 */
const buckets = new Map<string, { count: number; reset: number }>()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  bucket.count += 1
  return bucket.count <= limit
}

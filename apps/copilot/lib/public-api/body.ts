import { PublicApiError } from "./errors"

/** PostgreSQL text cannot store U+0000, so it would surface as a 500. */
function containsNul(value: unknown): boolean {
  if (typeof value === "string") return value.includes("\u0000")
  if (Array.isArray(value)) return value.some(containsNul)
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, item]) => key.includes("\u0000") || containsNul(item)
    )
  }
  return false
}

/** A malformed body is a client error, not a 500. */
export async function readJsonBody(request: Request): Promise<unknown> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new PublicApiError(
      "validation_error",
      "The request body must be valid JSON.",
      { status: 422 }
    )
  }
  if (containsNul(body)) {
    throw new PublicApiError(
      "validation_error",
      "Strings must not contain the NUL character (U+0000).",
      { status: 422 }
    )
  }
  return body
}

/** Forwarded to `callDomain` for mutations; best-effort across replicas. */
export function idempotencyKey(request: Request): string | undefined {
  return request.headers.get("idempotency-key") ?? undefined
}

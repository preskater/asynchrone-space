import { PublicApiError } from "./errors"

/** A malformed body is a client error, not a 500. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new PublicApiError(
      "validation_error",
      "The request body must be valid JSON.",
      { status: 422 }
    )
  }
}

/** Forwarded to `callDomain` for mutations; best-effort across replicas. */
export function idempotencyKey(request: Request): string | undefined {
  return request.headers.get("idempotency-key") ?? undefined
}

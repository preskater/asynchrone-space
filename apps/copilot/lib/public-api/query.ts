import { PublicApiPageQuerySchema } from "@workspace/contracts"
import { ValidationError } from "@workspace/core/errors"
import { pageSize } from "@workspace/core/pagination"

/** `limit`/`cursor` with the project-wide default and ceiling applied. */
export function pageQuery(url: URL): {
  limit: number
  cursor: string | null
} {
  const parsed = PublicApiPageQuerySchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  })
  return {
    limit: pageSize(parsed.limit),
    cursor: parsed.cursor ?? null,
  }
}

/** A query parameter the route cannot work without. */
export function requiredParam(url: URL, name: string): string {
  const value = url.searchParams.get(name)
  if (!value) {
    throw new ValidationError(`The ${name} query parameter is required.`)
  }
  return value
}

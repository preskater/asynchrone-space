import type { ZodType } from "zod"
import type { $ZodErrorMap } from "zod/v4/core"

/**
 * Parses `input` against `schema`.
 *
 * Pass an optional zod error map (e.g. `zodErrorMap(t)` from `@/lib/i18n/zod`)
 * to localize validation messages. Note zod v4 expects this under the `error`
 * parse-context key.
 */
export function parse<T>(
  schema: ZodType<T>,
  input: unknown,
  errorMap?: $ZodErrorMap
): T {
  return errorMap
    ? schema.parse(input, { error: errorMap })
    : schema.parse(input)
}

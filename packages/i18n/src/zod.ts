import type { $ZodErrorMap, $ZodRawIssue } from "zod/v4/core"

import { validationMessage } from "./zod-messages"

/**
 * Builds a zod error map that yields `Errors.validationMessages.*` catalog
 * messages using the provided translator. Pass it to `schema.parse(input, {
 * errorMap: zodErrorMap(t) })` (or use `parse` from `@/lib/core/validation`).
 *
 * The translator is intentionally typed as a plain function rather than the
 * next-intl `Translator` so this module stays free of any next-intl / React
 * import and can be used from both client and server code.
 */
export function zodErrorMap(
  t: (key: string, values?: Record<string, string | number>) => string
): $ZodErrorMap {
  return (issue: $ZodRawIssue) => {
    const message = validationMessage(issue, (key, values) =>
      t(key, values)
    )
    return message ? { message } : undefined
  }
}

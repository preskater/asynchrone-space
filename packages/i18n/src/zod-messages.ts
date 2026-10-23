/**
 * Locale-agnostic mapping from zod issues to `Errors.validationMessages.*`
 * catalog keys. Kept free of any `zod` runtime import so it can be reused from
 * both server and client code; the zod-typed wrapper lives in `./zod`.
 */

export type ValidationMessageKey =
  | "required"
  | "email"
  | "tooShort"
  | "tooLong"

export type ValidationTranslator = (
  key: ValidationMessageKey,
  values?: Record<string, string | number>
) => string

export interface ZodLikeIssue {
  code?: string
  format?: string
  origin?: string
  minimum?: number | bigint
  maximum?: number | bigint
}

/**
 * Returns the localized validation message for a zod issue, or `undefined` to
 * fall back to zod's default (English) message.
 */
export function validationMessage(
  issue: ZodLikeIssue,
  t: ValidationTranslator
): string | undefined {
  switch (issue.code) {
    case "invalid_type":
      return t("required")
    case "too_small":
      if (issue.origin !== "string") return t("required")
      return t("tooShort", { min: Number(issue.minimum) })
    case "too_big":
      return t("tooLong", { max: Number(issue.maximum) })
    case "invalid_format":
      return issue.format === "email" ? t("email") : undefined
    default:
      return undefined
  }
}

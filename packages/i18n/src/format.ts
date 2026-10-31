"use client"

import { useFormatter, useLocale, useTranslations } from "next-intl"

export function useFormatters() {
  const format = useFormatter()
  const locale = useLocale()
  const t = useTranslations("Common")

  return { format, locale, t }
}

import type { NextConfig } from "next"

export function createPreskNextConfig(
  projectRoot: string,
  options?: {
    globalNotFound?: boolean
    mdx?: boolean
    securityHeaders?: { key: string; value: string }[]
  }
): NextConfig

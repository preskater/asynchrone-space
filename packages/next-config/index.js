import path from "node:path"

const WORKSPACE_PACKAGES = [
  "@workspace/ui",
  "@workspace/db",
  "@workspace/core",
  "@workspace/organization",
  "@workspace/auth",
  "@workspace/i18n",
  "@workspace/app-shell",
  "@workspace/appearance",
  "@workspace/notifications",
  "@workspace/integrations",
  "@workspace/projects",
  "@workspace/calendars",
  "@workspace/files",
  "@workspace/messaging",
  "@workspace/crm",
  "@workspace/hr",
  "@workspace/meetings",
  "@workspace/portal",
  "@workspace/ai",
  "@workspace/storage",
]

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
]

/**
 * Shared Next.js configuration for every customer app. Keeping headers,
 * transpilation and standalone output in one place stops the apps from drifting.
 */
export function createPreskNextConfig(projectRoot, options = {}) {
  const {
    globalNotFound = false,
    mdx = false,
    securityHeaders = SECURITY_HEADERS,
  } = options

  return {
    output: "standalone",
    outputFileTracingRoot: path.join(projectRoot, "../../"),
    transpilePackages: WORKSPACE_PACKAGES,
    serverExternalPackages: ["pg-large-object", "pg"],
    pageExtensions: mdx
      ? ["js", "jsx", "md", "mdx", "ts", "tsx"]
      : ["js", "jsx", "ts", "tsx"],
    experimental: {
      ...(globalNotFound ? { globalNotFound: true } : {}),
      agentUpgrade: "security",
      serverActions: {
        bodySizeLimit: "8mb",
      },
    },
    async headers() {
      return [
        {
          source: "/(.*)",
          headers: securityHeaders,
        },
      ]
    },
  }
}

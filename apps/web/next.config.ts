import path from "node:path"
import { fileURLToPath } from "node:url"

import createMDX from "@next/mdx"
import createNextIntlPlugin from "next-intl/plugin"

import type { NextConfig } from "next"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(projectRoot, "../../"),
  transpilePackages: ["@workspace/ui", "@workspace/db"],
  // `pg-large-object` is CommonJS with native `pg` bindings; keep it external
  // so the server bundle loads it at runtime instead of trying to bundle it.
  serverExternalPackages: ["pg-large-object", "pg"],
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  experimental: {
    globalNotFound: true,
    agentUpgrade: "security",
    serverActions: {
      // The feedback form attaches one screenshot (base64, up to 5 MB).
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
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
          // Report-only to start: the app relies on inline theme scripts, so
          // tighten to enforcing once the report shows no violations.
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self'",
          },
        ],
      },
    ]
  },
}

const withMDX = createMDX({
  options: {
    remarkPlugins: [
      "remark-frontmatter",
      ["remark-mdx-frontmatter", { name: "frontmatter" }],
    ],
  },
})

const withNextIntl = createNextIntlPlugin()

export default withNextIntl(withMDX(nextConfig))

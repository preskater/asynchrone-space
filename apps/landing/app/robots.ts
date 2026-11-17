import type { MetadataRoute } from "next"

import { siteUrl } from "@/lib/seo"

/**
 * The landing is the only indexable app in the split. List the sitemap so
 * crawlers can discover every locale, and keep the workspace hosts out of the
 * index through their own `robots.txt` and `X-Robots-Tag` headers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    // `/api/v1` is the public REST API, served by Copilot through the apex
    // ingress; it is not a page and must not be indexed.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}

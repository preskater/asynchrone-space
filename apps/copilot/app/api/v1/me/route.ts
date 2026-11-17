import { publicJson, withPublicApi } from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** The token's identity, organization, scopes and plan limits. */
export const GET = withPublicApi({
  route: "GET /api/v1/me",
  handler: (ctx) => publicJson(ctx.me, ctx),
})

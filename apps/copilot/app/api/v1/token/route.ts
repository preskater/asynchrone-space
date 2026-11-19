import { PublicApiTokenInfoSchema } from "@workspace/contracts"

import { publicJson, withPublicApi } from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** The calling token, its owner and its organization; needs no scope. */
export const GET = withPublicApi({
  route: "GET /api/v1/token",
  handler: (ctx) =>
    publicJson(
      PublicApiTokenInfoSchema.parse({
        prefix: ctx.token.prefix,
        scopes: ctx.token.scopes,
        expiresAt: ctx.token.expiresAt?.toISOString() ?? null,
        user: { id: ctx.userId, name: ctx.userName, email: ctx.userEmail },
        organization: ctx.organization,
      }),
      ctx
    ),
})

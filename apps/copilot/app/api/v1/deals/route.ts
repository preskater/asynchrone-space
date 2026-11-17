import {
  PUBLIC_API_SCOPES,
  PublicCreateDealSchema,
  PublicDealSchema,
  publicPageResultSchema,
} from "@workspace/contracts"

import { callDomain } from "@/lib/internal/domain"
import {
  delegatedApiContext,
  idempotencyKey,
  pageQuery,
  publicJson,
  publicPage,
  readJsonBody,
  withPublicApi,
} from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withPublicApi({
  route: "GET /api/v1/deals",
  scope: PUBLIC_API_SCOPES.clientsRead,
  handler: async (ctx, request) => {
    const query = pageQuery(new URL(request.url))
    const page = await callDomain(
      "clients",
      "list-deals-page",
      delegatedApiContext(ctx),
      query,
      publicPageResultSchema(PublicDealSchema)
    )
    return publicPage(page.items, page.nextCursor, ctx)
  },
})

export const POST = withPublicApi({
  route: "POST /api/v1/deals",
  scope: PUBLIC_API_SCOPES.clientsWrite,
  handler: async (ctx, request) => {
    const body = PublicCreateDealSchema.parse(await readJsonBody(request))
    const deal = await callDomain(
      "clients",
      "public-create-deal",
      delegatedApiContext(ctx),
      body,
      PublicDealSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(deal, ctx, {}, { status: 201 })
  },
})

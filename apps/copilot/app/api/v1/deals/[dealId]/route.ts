import {
  PUBLIC_API_SCOPES,
  PublicDealSchema,
  PublicUpdateDealSchema,
} from "@workspace/contracts"

import { callDomain } from "@/lib/internal/domain"
import {
  delegatedApiContext,
  idempotencyKey,
  publicJson,
  readJsonBody,
  withPublicApi,
} from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DealRoute = { params: Promise<{ dealId: string }> }

export const GET = withPublicApi<DealRoute>({
  route: "GET /api/v1/deals/{dealId}",
  scope: PUBLIC_API_SCOPES.clientsRead,
  handler: async (ctx, _request, { params }) => {
    const { dealId } = await params
    const deal = await callDomain(
      "clients",
      "get-public-deal",
      delegatedApiContext(ctx),
      { id: dealId },
      PublicDealSchema
    )
    return publicJson(deal, ctx)
  },
})

export const PATCH = withPublicApi<DealRoute>({
  route: "PATCH /api/v1/deals/{dealId}",
  scope: PUBLIC_API_SCOPES.clientsWrite,
  handler: async (ctx, request, { params }) => {
    const { dealId } = await params
    const body = PublicUpdateDealSchema.parse(await readJsonBody(request))
    const deal = await callDomain(
      "clients",
      "public-update-deal",
      delegatedApiContext(ctx),
      { id: dealId, ...body },
      PublicDealSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(deal, ctx)
  },
})

import {
  PUBLIC_API_SCOPES,
  PublicDealSchema,
  PublicMoveDealSchema,
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

export const POST = withPublicApi<{
  params: Promise<{ dealId: string }>
}>({
  route: "POST /api/v1/deals/{dealId}/move",
  scope: PUBLIC_API_SCOPES.clientsWrite,
  handler: async (ctx, request, { params }) => {
    const { dealId } = await params
    const body = PublicMoveDealSchema.parse(await readJsonBody(request))
    const deal = await callDomain(
      "clients",
      "public-move-deal",
      delegatedApiContext(ctx),
      { id: dealId, ...body },
      PublicDealSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(deal, ctx)
  },
})

import {
  PUBLIC_API_SCOPES,
  PublicClientSchema,
  PublicCreateClientSchema,
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
  route: "GET /api/v1/clients",
  scope: PUBLIC_API_SCOPES.clientsRead,
  handler: async (ctx, request) => {
    const query = pageQuery(new URL(request.url))
    const page = await callDomain(
      "clients",
      "list-clients-page",
      delegatedApiContext(ctx),
      query,
      publicPageResultSchema(PublicClientSchema)
    )
    return publicPage(page.items, page.nextCursor, ctx)
  },
})

export const POST = withPublicApi({
  route: "POST /api/v1/clients",
  scope: PUBLIC_API_SCOPES.clientsWrite,
  handler: async (ctx, request) => {
    const body = PublicCreateClientSchema.parse(await readJsonBody(request))
    const client = await callDomain(
      "clients",
      "public-create-client",
      delegatedApiContext(ctx),
      body,
      PublicClientSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(client, ctx, {}, { status: 201 })
  },
})

import {
  PUBLIC_API_SCOPES,
  PublicContactSchema,
  PublicCreateContactSchema,
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
  route: "GET /api/v1/contacts",
  scope: PUBLIC_API_SCOPES.clientsRead,
  handler: async (ctx, request) => {
    const query = pageQuery(new URL(request.url))
    const page = await callDomain(
      "clients",
      "list-contacts-page",
      delegatedApiContext(ctx),
      query,
      publicPageResultSchema(PublicContactSchema)
    )
    return publicPage(page.items, page.nextCursor, ctx)
  },
})

export const POST = withPublicApi({
  route: "POST /api/v1/contacts",
  scope: PUBLIC_API_SCOPES.clientsWrite,
  handler: async (ctx, request) => {
    const body = PublicCreateContactSchema.parse(await readJsonBody(request))
    const contact = await callDomain(
      "clients",
      "public-create-contact",
      delegatedApiContext(ctx),
      body,
      PublicContactSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(contact, ctx, {}, { status: 201 })
  },
})

import {
  PUBLIC_API_SCOPES,
  PublicContactSchema,
  PublicUpdateContactSchema,
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

type ContactRoute = { params: Promise<{ contactId: string }> }

export const GET = withPublicApi<ContactRoute>({
  route: "GET /api/v1/contacts/{contactId}",
  scope: PUBLIC_API_SCOPES.clientsRead,
  handler: async (ctx, _request, { params }) => {
    const { contactId } = await params
    const contact = await callDomain(
      "clients",
      "get-contact",
      delegatedApiContext(ctx),
      { id: contactId },
      PublicContactSchema
    )
    return publicJson(contact, ctx)
  },
})

export const PATCH = withPublicApi<ContactRoute>({
  route: "PATCH /api/v1/contacts/{contactId}",
  scope: PUBLIC_API_SCOPES.clientsWrite,
  handler: async (ctx, request, { params }) => {
    const { contactId } = await params
    const body = PublicUpdateContactSchema.parse(await readJsonBody(request))
    const contact = await callDomain(
      "clients",
      "public-update-contact",
      delegatedApiContext(ctx),
      { id: contactId, ...body },
      PublicContactSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(contact, ctx)
  },
})

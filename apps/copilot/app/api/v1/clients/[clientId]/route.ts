import {
  PUBLIC_API_SCOPES,
  PublicClientSchema,
  PublicUpdateClientSchema,
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

type ClientRoute = { params: Promise<{ clientId: string }> }

export const GET = withPublicApi<ClientRoute>({
  route: "GET /api/v1/clients/{clientId}",
  scope: PUBLIC_API_SCOPES.clientsRead,
  handler: async (ctx, _request, { params }) => {
    const { clientId } = await params
    const client = await callDomain(
      "clients",
      "get-public-client",
      delegatedApiContext(ctx),
      { id: clientId },
      PublicClientSchema
    )
    return publicJson(client, ctx)
  },
})

export const PATCH = withPublicApi<ClientRoute>({
  route: "PATCH /api/v1/clients/{clientId}",
  scope: PUBLIC_API_SCOPES.clientsWrite,
  handler: async (ctx, request, { params }) => {
    const { clientId } = await params
    const body = PublicUpdateClientSchema.parse(await readJsonBody(request))
    const client = await callDomain(
      "clients",
      "public-update-client",
      delegatedApiContext(ctx),
      { id: clientId, ...body },
      PublicClientSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(client, ctx)
  },
})

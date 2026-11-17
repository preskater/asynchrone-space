import { PUBLIC_API_SCOPES, PublicFileSchema } from "@workspace/contracts"

import { callDomain } from "@/lib/internal/domain"
import {
  delegatedApiContext,
  publicJson,
  withPublicApi,
} from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withPublicApi<{
  params: Promise<{ fileId: string }>
}>({
  route: "GET /api/v1/files/{fileId}",
  scope: PUBLIC_API_SCOPES.filesRead,
  handler: async (ctx, _request, { params }) => {
    const { fileId } = await params
    const file = await callDomain(
      "files",
      "get-file-metadata",
      delegatedApiContext(ctx),
      { fileId },
      PublicFileSchema
    )
    return publicJson(file, ctx)
  },
})

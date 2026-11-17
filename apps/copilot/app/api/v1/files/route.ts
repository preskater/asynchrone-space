import {
  PUBLIC_API_SCOPES,
  PublicFileSchema,
  PublicFilesQuerySchema,
  publicPageResultSchema,
} from "@workspace/contracts"
import { pageSize } from "@workspace/core/pagination"

import { callDomain } from "@/lib/internal/domain"
import {
  delegatedApiContext,
  publicPage,
  withPublicApi,
} from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withPublicApi({
  route: "GET /api/v1/files",
  scope: PUBLIC_API_SCOPES.filesRead,
  handler: async (ctx, request) => {
    const url = new URL(request.url)
    const query = PublicFilesQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      parentId: url.searchParams.get("parentId") ?? undefined,
    })
    const page = await callDomain(
      "files",
      "list-files-page",
      delegatedApiContext(ctx),
      {
        limit: pageSize(query.limit),
        cursor: query.cursor,
        parentId: query.parentId,
      },
      publicPageResultSchema(PublicFileSchema)
    )
    return publicPage(page.items, page.nextCursor, ctx)
  },
})

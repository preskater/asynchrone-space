import {
  PUBLIC_API_SCOPES,
  PublicCreateProjectSchema,
  PublicProjectSchema,
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
  route: "GET /api/v1/projects",
  scope: PUBLIC_API_SCOPES.projectsRead,
  handler: async (ctx, request) => {
    const query = pageQuery(new URL(request.url))
    const page = await callDomain(
      "projects",
      "list-projects-page",
      delegatedApiContext(ctx),
      query,
      publicPageResultSchema(PublicProjectSchema)
    )
    return publicPage(page.items, page.nextCursor, ctx)
  },
})

export const POST = withPublicApi({
  route: "POST /api/v1/projects",
  scope: PUBLIC_API_SCOPES.projectsWrite,
  handler: async (ctx, request) => {
    const body = PublicCreateProjectSchema.parse(await readJsonBody(request))
    const project = await callDomain(
      "projects",
      "public-create-project",
      delegatedApiContext(ctx),
      body,
      PublicProjectSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(project, ctx, {}, { status: 201 })
  },
})

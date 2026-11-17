import {
  PUBLIC_API_SCOPES,
  PublicDeleteResultSchema,
  PublicProjectSchema,
  PublicUpdateProjectSchema,
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

type ProjectRoute = { params: Promise<{ projectId: string }> }

export const GET = withPublicApi<ProjectRoute>({
  route: "GET /api/v1/projects/{projectId}",
  scope: PUBLIC_API_SCOPES.projectsRead,
  handler: async (ctx, _request, { params }) => {
    const { projectId } = await params
    const project = await callDomain(
      "projects",
      "get-public-project",
      delegatedApiContext(ctx),
      { projectId },
      PublicProjectSchema
    )
    return publicJson(project, ctx)
  },
})

export const PATCH = withPublicApi<ProjectRoute>({
  route: "PATCH /api/v1/projects/{projectId}",
  scope: PUBLIC_API_SCOPES.projectsWrite,
  handler: async (ctx, request, { params }) => {
    const { projectId } = await params
    const body = PublicUpdateProjectSchema.parse(await readJsonBody(request))
    const project = await callDomain(
      "projects",
      "public-update-project",
      delegatedApiContext(ctx),
      { projectId, ...body },
      PublicProjectSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(project, ctx)
  },
})

export const DELETE = withPublicApi<ProjectRoute>({
  route: "DELETE /api/v1/projects/{projectId}",
  scope: PUBLIC_API_SCOPES.projectsWrite,
  handler: async (ctx, request, { params }) => {
    const { projectId } = await params
    const result = await callDomain(
      "projects",
      "public-delete-project",
      delegatedApiContext(ctx),
      { projectId },
      PublicDeleteResultSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(result, ctx)
  },
})

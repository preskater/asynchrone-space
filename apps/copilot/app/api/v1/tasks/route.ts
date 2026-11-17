import {
  PUBLIC_API_SCOPES,
  PublicCreateTaskSchema,
  PublicTaskSchema,
  PublicTasksQuerySchema,
  publicPageResultSchema,
} from "@workspace/contracts"
import { pageSize } from "@workspace/core/pagination"

import { callDomain } from "@/lib/internal/domain"
import {
  delegatedApiContext,
  idempotencyKey,
  publicJson,
  publicPage,
  readJsonBody,
  withPublicApi,
} from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withPublicApi({
  route: "GET /api/v1/tasks",
  scope: PUBLIC_API_SCOPES.tasksRead,
  handler: async (ctx, request) => {
    const url = new URL(request.url)
    const query = PublicTasksQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      projectId: url.searchParams.get("projectId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    })
    const page = await callDomain(
      "projects",
      "list-tasks-page",
      delegatedApiContext(ctx),
      {
        limit: pageSize(query.limit),
        cursor: query.cursor,
        projectId: query.projectId,
        status: query.status,
      },
      publicPageResultSchema(PublicTaskSchema)
    )
    return publicPage(page.items, page.nextCursor, ctx)
  },
})

export const POST = withPublicApi({
  route: "POST /api/v1/tasks",
  scope: PUBLIC_API_SCOPES.tasksWrite,
  handler: async (ctx, request) => {
    const body = PublicCreateTaskSchema.parse(await readJsonBody(request))
    const task = await callDomain(
      "projects",
      "public-create-task",
      delegatedApiContext(ctx),
      body,
      PublicTaskSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(task, ctx, {}, { status: 201 })
  },
})

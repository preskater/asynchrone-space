import {
  PUBLIC_API_SCOPES,
  PublicDeleteResultSchema,
  PublicTaskSchema,
  PublicUpdateTaskSchema,
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

type TaskRoute = { params: Promise<{ taskId: string }> }

export const GET = withPublicApi<TaskRoute>({
  route: "GET /api/v1/tasks/{taskId}",
  scope: PUBLIC_API_SCOPES.tasksRead,
  handler: async (ctx, _request, { params }) => {
    const { taskId } = await params
    const task = await callDomain(
      "projects",
      "get-task",
      delegatedApiContext(ctx),
      { taskId },
      PublicTaskSchema
    )
    return publicJson(task, ctx)
  },
})

export const PATCH = withPublicApi<TaskRoute>({
  route: "PATCH /api/v1/tasks/{taskId}",
  scope: PUBLIC_API_SCOPES.tasksWrite,
  handler: async (ctx, request, { params }) => {
    const { taskId } = await params
    const body = PublicUpdateTaskSchema.parse(await readJsonBody(request))
    const task = await callDomain(
      "projects",
      "public-update-task",
      delegatedApiContext(ctx),
      { taskId, ...body },
      PublicTaskSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(task, ctx)
  },
})

export const DELETE = withPublicApi<TaskRoute>({
  route: "DELETE /api/v1/tasks/{taskId}",
  scope: PUBLIC_API_SCOPES.tasksWrite,
  handler: async (ctx, request, { params }) => {
    const { taskId } = await params
    const result = await callDomain(
      "projects",
      "public-delete-task",
      delegatedApiContext(ctx),
      { taskId },
      PublicDeleteResultSchema,
      { idempotencyKey: idempotencyKey(request) }
    )
    return publicJson(result, ctx)
  },
})

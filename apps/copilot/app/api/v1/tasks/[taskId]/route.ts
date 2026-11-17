import {
  PUBLIC_API_SCOPES,
  PublicDeleteResultSchema,
  PublicTaskSchema,
} from "@workspace/contracts"

import {
  apiJson,
  apiUserAgent,
  readJson,
  withApiToken,
  withTaskUrls,
} from "@/lib/api/v1"
import { ApiTaskSchema, UpdateTaskBodySchema } from "@/lib/api/schemas"
import { callDomain, delegatedContext } from "@/lib/internal/domain"
import {
  delegatedApiContext,
  idempotencyKey,
  publicJson,
  withPublicApi,
} from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Updates the given fields of a task; omitted fields are left unchanged. */
export const PATCH = withApiToken<{ taskId: string }>(
  "/api/v1/tasks/[taskId]",
  "tasks:write",
  async (token, request, { taskId }) => {
    const patch = UpdateTaskBodySchema.parse(await readJson(request))
    const task = await callDomain(
      "projects",
      "update-task",
      delegatedContext(token.ctx),
      { taskId, ...patch },
      ApiTaskSchema,
      {
        userAgent: apiUserAgent(token, request),
        idempotencyKey:
          request.headers.get("idempotency-key")?.slice(0, 200) || undefined,
      }
    )
    const [withUrl] = await withTaskUrls(token, [task])
    return apiJson(withUrl)
  }
)

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

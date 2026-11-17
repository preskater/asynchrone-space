import { z } from "zod"

import {
  PublicCreateProjectSchema,
  PublicProjectSchema,
} from "@workspace/contracts"

import { apiJson, apiList, apiUserAgent, withApiToken } from "@/lib/api/v1"
import { ApiProjectSchema, ProjectShellSchema } from "@/lib/api/schemas"
import { callDomain, delegatedContext } from "@/lib/internal/domain"
import { idempotencyKey, readJsonBody } from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Projects of the token's organization, each with its labels. */
export const GET = withApiToken(
  "/api/v1/projects",
  "projects:read",
  async (token, request) => {
    const { projects, labels } = await callDomain(
      "projects",
      "list-project-shell",
      delegatedContext(token.ctx),
      {},
      ProjectShellSchema,
      { userAgent: apiUserAgent(token, request) }
    )
    const byId = new Map(labels.map((label) => [label.id, label]))
    return apiList(
      z.array(ApiProjectSchema).parse(
        projects.map(({ labelIds, ...project }) => ({
          ...project,
          labels: labelIds.flatMap((id) => byId.get(id) ?? []),
        }))
      )
    )
  }
)

/** Creates a project; retrying with the same `Idempotency-Key` is safe. */
export const POST = withApiToken(
  "/api/v1/projects",
  "projects:write",
  async (token, request) => {
    const body = PublicCreateProjectSchema.parse(await readJsonBody(request))
    const project = await callDomain(
      "projects",
      "public-create-project",
      delegatedContext(token.ctx),
      body,
      PublicProjectSchema,
      {
        userAgent: apiUserAgent(token, request),
        idempotencyKey: idempotencyKey(request),
      }
    )
    return apiJson(project, { status: 201 })
  }
)

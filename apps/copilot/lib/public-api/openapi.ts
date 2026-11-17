import { z } from "zod"

import {
  PUBLIC_API_COMPONENTS,
  PUBLIC_API_ROUTES,
  PUBLIC_API_TAGS,
  type PublicApiResponse,
  type PublicApiRoute,
} from "@workspace/contracts"

/**
 * OpenAPI 3.1 is built from the same Zod schemas the routes validate with.
 * `z.toJSONSchema` targets JSON Schema 2020-12, the dialect OpenAPI 3.1 uses.
 */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const generated = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    unrepresentable: "any",
  }) as Record<string, unknown>
  delete generated.$schema
  return generated
}

function ref(component: string): Record<string, unknown> {
  return { $ref: `#/components/schemas/${component}` }
}

function requestMeta(): Record<string, unknown> {
  return {
    type: "object",
    required: ["requestId"],
    properties: { requestId: { type: "string" } },
  }
}

function responseSchema(response: PublicApiResponse): Record<string, unknown> {
  if (response.kind === "delete") {
    return {
      type: "object",
      required: ["data", "meta"],
      properties: { data: ref("DeleteResult"), meta: requestMeta() },
    }
  }
  if (response.kind === "item") {
    return {
      type: "object",
      required: ["data", "meta"],
      properties: { data: ref(response.component), meta: requestMeta() },
    }
  }
  return {
    type: "object",
    required: ["data", "meta"],
    properties: {
      data: { type: "array", items: ref(response.component) },
      meta: {
        type: "object",
        required: ["requestId", "nextCursor", "hasMore"],
        properties: {
          requestId: { type: "string" },
          nextCursor: { anyOf: [{ type: "string" }, { type: "null" }] },
          hasMore: { type: "boolean" },
        },
      },
    },
  }
}

function pathParameters(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: { type: "string" },
  }))
}

function queryParameters(schema: z.ZodType) {
  const generated = jsonSchema(schema) as {
    properties?: Record<string, unknown>
    required?: string[]
  }
  const required = new Set(generated.required ?? [])
  return Object.entries(generated.properties ?? {}).map(([name, property]) => ({
    name,
    in: "query",
    required: required.has(name),
    schema: property,
  }))
}

function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: ref("Error") } },
  }
}

function operation(route: PublicApiRoute): Record<string, unknown> {
  const parameters = [
    ...pathParameters(route.path),
    ...(route.query ? queryParameters(route.query) : []),
  ]
  const status = route.status ?? 200
  const responses: Record<string, unknown> = {
    [String(status)]: {
      description: status === 201 ? "Created" : "Success",
      content: {
        "application/json": { schema: responseSchema(route.response) },
      },
    },
    401: errorResponse("Missing, invalid, expired or revoked token."),
    403: errorResponse(
      "The token lacks the scope or the member is not allowed to do this."
    ),
    404: errorResponse("The resource is not in this organization."),
    409: errorResponse("The change conflicts with existing data."),
    422: errorResponse("The request failed validation."),
    429: errorResponse("The token exceeded its plan rate limit."),
    500: errorResponse("Unexpected server error."),
    502: errorResponse("An upstream domain app is unavailable."),
  }

  return {
    operationId: route.operationId,
    summary: route.summary,
    ...(route.description ? { description: route.description } : {}),
    tags: [route.tag],
    security: [{ bearerAuth: route.scope ? [route.scope] : [] }],
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(route.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: jsonSchema(route.body) } },
          },
        }
      : {}),
    responses,
  }
}

export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const route of PUBLIC_API_ROUTES) {
    const path = (paths[route.path] ??= {})
    path[route.method.toLowerCase()] = operation(route)
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Asynchrone Space API",
      version: "1.0.0",
      description: [
        "Organization-scoped REST API for Asynchrone Space.",
        "Authenticate with `Authorization: Bearer async_…`; every token belongs to one organization.",
        "Lists use opaque cursors: pass `limit` (1–100, default 50) and the previous `meta.nextCursor`.",
        "Errors use `{ error: { code, message, details? }, meta: { requestId } }`.",
        "Rate limits are per token and follow the workspace plan; responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`.",
      ].join("\n\n"),
      license: { name: "Elastic License 2.0" },
    },
    servers: [
      { url: "https://asynchrone.space", description: "Production" },
      { url: "http://localhost:3000", description: "Local development" },
    ],
    tags: PUBLIC_API_TAGS,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "async_<token>",
          description:
            "A public API token created in Settings → Developers. The raw value is shown once.",
        },
      },
      schemas: Object.fromEntries(
        Object.entries(PUBLIC_API_COMPONENTS).map(([name, schema]) => [
          name,
          jsonSchema(schema),
        ])
      ),
    },
  }
}

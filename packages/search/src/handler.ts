import {
  INTERNAL_API_VERSION,
  SearchQuerySchema,
  type SearchQuery,
  type SearchResult,
} from "@workspace/contracts"

/** The app's own search implementation, scoped to one organization. */
export type SearchImplementation = (
  input: SearchQuery
) => Promise<SearchResult[]>

export interface SearchHttpOptions {
  app: string
  authorize: (request: Request) => Promise<unknown>
  search: SearchImplementation
}

function isHttpError(value: unknown): value is {
  status: number
  code: string
  message: string
} {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { status?: unknown }).status === "number" &&
    typeof (value as { code?: unknown }).code === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  )
}

/** `GET /internal/v1/search` — this app's slice of a global search. */
export function createSearchHandler(options: SearchHttpOptions) {
  return async function GET(request: Request): Promise<Response> {
    try {
      await options.authorize(request)
    } catch (cause) {
      if (isHttpError(cause)) {
        return Response.json(
          { error: { code: cause.code, message: cause.message } },
          { status: cause.status, headers: { "Cache-Control": "no-store" } }
        )
      }
      return Response.json(
        {
          error: {
            code: "unauthorized",
            message: "A valid service token is required",
          },
        },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }

    try {
      const search = new URL(request.url).searchParams
      const input = SearchQuerySchema.parse({
        organizationId: search.get("organizationId"),
        query: search.get("q"),
        limit: search.get("limit") ? Number(search.get("limit")) : 20,
      })
      const results = await options.search(input)
      return Response.json(
        {
          data: { results },
          meta: {
            app: options.app,
            version: INTERNAL_API_VERSION,
            requestId: crypto.randomUUID(),
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      )
    } catch (cause) {
      console.error("[search] internal request failed", cause)
      return Response.json(
        {
          error: {
            code: "validation_error",
            message: "Invalid search request",
          },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }
  }
}

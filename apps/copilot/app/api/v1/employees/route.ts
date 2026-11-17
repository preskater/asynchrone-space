import { PUBLIC_API_SCOPES } from "@workspace/contracts"

import {
  listEmployeesPage,
  pageQuery,
  publicPage,
  withPublicApi,
} from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withPublicApi({
  route: "GET /api/v1/employees",
  scope: PUBLIC_API_SCOPES.employeesRead,
  handler: async (ctx, request) => {
    const page = await listEmployeesPage(ctx, pageQuery(new URL(request.url)))
    return publicPage(page.items, page.nextCursor, ctx)
  },
})

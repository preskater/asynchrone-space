import { PUBLIC_API_SCOPES } from "@workspace/contracts"

import { getEmployee, publicJson, withPublicApi } from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = withPublicApi<{
  params: Promise<{ userId: string }>
}>({
  route: "GET /api/v1/employees/{userId}",
  scope: PUBLIC_API_SCOPES.employeesRead,
  handler: async (ctx, _request, { params }) => {
    const { userId } = await params
    return publicJson(await getEmployee(ctx, userId), ctx)
  },
})

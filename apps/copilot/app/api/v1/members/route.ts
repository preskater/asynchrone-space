import { PUBLIC_API_SCOPES, PublicApiMemberSchema } from "@workspace/contracts"
import { parseRoles } from "@workspace/organization/roles"

import { prisma } from "@/lib/prisma"
import { publicPage, withPublicApi } from "@/lib/public-api"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Workspace members (portal accounts excluded), to resolve task assignees. */
export const GET = withPublicApi({
  route: "GET /api/v1/members",
  scope: PUBLIC_API_SCOPES.membersRead,
  handler: async (ctx) => {
    const rows = await prisma.member.findMany({
      where: { organizationId: ctx.organization.id, clientId: null },
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: "asc" } },
    })
    const members = rows.map(({ role, user }) =>
      PublicApiMemberSchema.parse({ ...user, roles: parseRoles(role) })
    )
    // The directory is one page: an organization's members are bounded.
    return publicPage(members, null, ctx)
  },
})

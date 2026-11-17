import {
  EmployeeProfilesResultSchema,
  PublicEmployeeSchema,
  type PublicEmployee,
  type PublicEmployeeProfile,
} from "@workspace/contracts"
import { NotFoundError } from "@workspace/core/errors"
import {
  decodeCursor,
  encodeCursor,
  pageSize,
  toPage,
  type Page,
  type PageInput,
} from "@workspace/core/pagination"

import { callDomain } from "@/lib/internal/domain"
import { prisma } from "@/lib/prisma"

import type { PublicApiContext } from "./auth"
import { delegatedApiContext } from "./delegation"

/**
 * Employees span two databases: the membership row is in identity, the profile
 * in the employees app. Copilot pages the members (repository layer) and asks
 * the employees app only for the profiles of that page.
 */
const MEMBER_SELECT = {
  id: true,
  role: true,
  createdAt: true,
  user: {
    select: { id: true, name: true, email: true, image: true },
  },
} as const

type MemberRow = {
  id: string
  role: string
  createdAt: Date
  user: {
    id: string
    name: string
    email: string
    image: string | null
  }
}

type EmployeeProfile = PublicEmployeeProfile

function profilesFor(ctx: PublicApiContext, userIds: string[]) {
  if (userIds.length === 0) {
    return Promise.resolve({ profiles: [] as EmployeeProfile[] })
  }
  return callDomain(
    "employees",
    "get-employee-profiles",
    delegatedApiContext(ctx),
    { userIds },
    EmployeeProfilesResultSchema
  )
}

function employee(member: MemberRow, profile: EmployeeProfile): PublicEmployee {
  return PublicEmployeeSchema.parse({
    userId: member.user.id,
    name: member.user.name,
    email: member.user.email,
    avatarUrl: member.user.image ?? null,
    orgRole: member.role,
    createdAt: member.createdAt.toISOString(),
    employmentType: profile.employmentType,
    contractType: profile.contractType,
    weeklyHours: profile.weeklyHours,
    managerId: profile.managerId ?? null,
    isValidator: profile.isValidator,
    isActive: profile.isActive,
  })
}

export async function listEmployeesPage(
  ctx: PublicApiContext,
  input: PageInput
): Promise<Page<PublicEmployee>> {
  const limit = pageSize(input.limit)
  const decoded = decodeCursor(input.cursor)
  const after =
    decoded && decoded[0] && decoded[1]
      ? { createdAt: new Date(decoded[0]), id: decoded[1] }
      : null

  const rows = await prisma.member.findMany({
    where: {
      organizationId: ctx.organization.id,
      clientId: null,
      ...(after
        ? {
            OR: [
              { createdAt: { gt: after.createdAt } },
              { createdAt: after.createdAt, id: { gt: after.id } },
            ],
          }
        : {}),
    },
    select: MEMBER_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
  })

  const page = toPage(rows, limit, (row) =>
    encodeCursor([row.createdAt.toISOString(), row.id])
  )
  const { profiles } = await profilesFor(
    ctx,
    page.items.map((row) => row.user.id)
  )
  const byUser = new Map(profiles.map((profile) => [profile.userId, profile]))

  return {
    items: page.items.map((row): PublicEmployee => {
      const profile = byUser.get(row.user.id)
      if (!profile) {
        throw new Error(`No employee profile returned for ${row.user.id}`)
      }
      return employee(row, profile)
    }),
    nextCursor: page.nextCursor,
  }
}

export async function getEmployee(
  ctx: PublicApiContext,
  userId: string
): Promise<PublicEmployee> {
  const member = (await prisma.member.findFirst({
    where: {
      organizationId: ctx.organization.id,
      userId,
      clientId: null,
    },
    select: MEMBER_SELECT,
  })) as MemberRow | null
  if (!member) throw new NotFoundError("Employee")

  const { profiles } = await profilesFor(ctx, [userId])
  const profile = profiles.find((item) => item.userId === userId)
  if (!profile) throw new NotFoundError("Employee")
  return employee(member, profile)
}

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  memberFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  callDomain: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    member: {
      findMany: mocks.memberFindMany,
      findFirst: mocks.memberFindFirst,
    },
  },
}))
vi.mock("@/lib/internal/domain", () => ({ callDomain: mocks.callDomain }))

import type { PublicApiContext } from "./auth"
import { getEmployee, listEmployeesPage } from "./employees"

const ctx = {
  organization: { id: "org_1", name: "Acme", slug: "acme" },
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
  role: "member",
  actor: { id: "api-token:tok_1", name: "CI", email: "ada@example.com" },
} as PublicApiContext

const member = {
  id: "mem_1",
  role: "member",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  user: {
    id: "user_1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
  },
}

const profile = {
  userId: "user_1",
  employmentType: "employee",
  contractType: "cdi",
  weeklyHours: 35,
  managerId: null,
  isValidator: false,
  isActive: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.memberFindMany.mockResolvedValue([member])
  mocks.memberFindFirst.mockResolvedValue(member)
  mocks.callDomain.mockResolvedValue({ profiles: [profile] })
})

describe("listEmployeesPage", () => {
  it("pages members by organization and merges the bounded profile page", async () => {
    const page = await listEmployeesPage(ctx, {})

    expect(mocks.memberFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org_1",
          clientId: null,
        }),
        take: 51,
      })
    )
    expect(mocks.callDomain).toHaveBeenCalledWith(
      "employees",
      "get-employee-profiles",
      expect.anything(),
      { userIds: ["user_1"] },
      expect.anything()
    )
    expect(page.items).toEqual([
      {
        userId: "user_1",
        name: "Ada",
        email: "ada@example.com",
        avatarUrl: null,
        orgRole: "member",
        createdAt: "2026-01-01T00:00:00.000Z",
        employmentType: "employee",
        contractType: "cdi",
        weeklyHours: 35,
        managerId: null,
        isValidator: false,
        isActive: true,
      },
    ])
    expect(page.nextCursor).toBeNull()
  })

  it("does not call the employees app for an empty page", async () => {
    mocks.memberFindMany.mockResolvedValue([])
    const page = await listEmployeesPage(ctx, { limit: 10 })
    expect(page.items).toEqual([])
    expect(mocks.callDomain).not.toHaveBeenCalled()
  })
})

describe("getEmployee", () => {
  it("returns one member merged with its profile", async () => {
    const employee = await getEmployee(ctx, "user_1")
    expect(employee.userId).toBe("user_1")
    expect(employee.weeklyHours).toBe(35)
    expect(mocks.memberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org_1",
          userId: "user_1",
          clientId: null,
        },
      })
    )
  })

  it("hides a member from another organization", async () => {
    mocks.memberFindFirst.mockResolvedValue(null)
    await expect(getEmployee(ctx, "user_2")).rejects.toMatchObject({
      code: "not_found",
    })
  })
})

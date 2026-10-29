import { beforeEach, describe, expect, it, vi } from "vitest"

const prisma = vi.hoisted(() => ({
  organization: { findUnique: vi.fn() },
  member: { count: vi.fn() },
  invitation: { count: vi.fn() },
}))
vi.mock("@/lib/prisma", () => ({ prisma }))

import {
  hasEntitlement,
  parsePlan,
  type Entitlement,
} from "@workspace/db/plans"

import {
  can,
  entitlementsFor,
  getOrganizationPlan,
  requireEntitlement,
  seatLimitReached,
  seatsFull,
  type OrgPlan,
} from "./entitlements"

const GB = 1024 ** 3

// The contract the pricing page sells; change it only together with pricing.json.
const expected: Record<OrgPlan, Record<Entitlement, number | boolean>> = {
  free: {
    seats: 5,
    storageBytes: 1 * GB,
    aiTokensPerMonth: 0,
    auditLog: false,
    sso: false,
    scim: false,
    granularPermissions: false,
    apiAccess: true,
  },
  team: {
    seats: Infinity,
    storageBytes: 100 * GB,
    aiTokensPerMonth: 2_000_000,
    auditLog: false,
    sso: false,
    scim: false,
    granularPermissions: true,
    apiAccess: true,
  },
  enterprise: {
    seats: Infinity,
    storageBytes: 1024 * GB,
    aiTokensPerMonth: 20_000_000,
    auditLog: true,
    sso: true,
    scim: true,
    granularPermissions: true,
    apiAccess: true,
  },
}

function withPlan(metadata: string | null) {
  prisma.organization.findUnique.mockResolvedValue({ metadata })
}

beforeEach(() => vi.clearAllMocks())

describe("entitlementsFor", () => {
  for (const plan of Object.keys(expected) as OrgPlan[]) {
    for (const [entitlement, value] of Object.entries(expected[plan])) {
      it(`${plan}.${entitlement} = ${value}`, () => {
        const entitlements = entitlementsFor(plan)
        expect(entitlements[entitlement as Entitlement]).toBe(value)
        expect(hasEntitlement(entitlements, entitlement as Entitlement)).toBe(
          Boolean(value)
        )
      })
    }
  }
})

describe("plan resolution", () => {
  it.each([
    [null, "free"],
    ["", "free"],
    ["not json", "free"],
    ['{"accent":"blue"}', "free"],
    ['{"plan":"platinum"}', "free"],
    ['{"plan":"team"}', "team"],
    ['{"plan":"enterprise","accent":"blue"}', "enterprise"],
  ])("parsePlan(%j) = %s", (metadata, plan) => {
    expect(parsePlan(metadata)).toBe(plan)
  })

  it("resolves a missing organization to free", async () => {
    prisma.organization.findUnique.mockResolvedValue(null)
    expect(await getOrganizationPlan("org_1")).toBe("free")
  })

  it("gates features on the stored plan", async () => {
    withPlan(null)
    expect(await can("org_1", "aiTokensPerMonth")).toBe(false)
    await expect(
      requireEntitlement("org_1", "granularPermissions")
    ).rejects.toMatchObject({
      code: "upgrade_required",
      status: 403,
      params: { entitlement: "granularPermissions" },
    })

    withPlan('{"plan":"team"}')
    expect(await can("org_1", "aiTokensPerMonth")).toBe(true)
    await expect(
      requireEntitlement("org_1", "granularPermissions")
    ).resolves.toBeUndefined()
  })
})

describe("seats", () => {
  it.each([
    [5, 4, 0, false],
    [5, 5, 0, true],
    [5, 4, 1, true],
    [5, 3, 1, false],
    [Infinity, 10_000, 500, false],
  ])(
    "seats=%s members=%s pending=%s → full=%s",
    (seats, members, pending, full) => {
      expect(seatLimitReached(seats, members, pending)).toBe(full)
    }
  )

  it("blocks a 6th member on Starter, excluding portal clients", async () => {
    withPlan(null)
    prisma.member.count.mockResolvedValue(5)
    expect(await seatsFull("org_1", { countPending: false })).toEqual({
      full: true,
      seats: 5,
    })
    expect(prisma.member.count).toHaveBeenCalledWith({
      where: { organizationId: "org_1", clientId: null },
    })
  })

  it("counts pending workspace invitations when inviting", async () => {
    withPlan(null)
    prisma.member.count.mockResolvedValue(4)
    prisma.invitation.count.mockResolvedValue(1)
    expect((await seatsFull("org_1", { countPending: true })).full).toBe(true)
    expect(prisma.invitation.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: "pending",
        NOT: { role: "client" },
      }),
    })
  })

  it("never counts seats on unlimited plans", async () => {
    withPlan('{"plan":"team"}')
    expect((await seatsFull("org_1", { countPending: true })).full).toBe(false)
    expect(prisma.member.count).not.toHaveBeenCalled()
  })
})

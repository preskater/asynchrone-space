import { describe, expect, it, vi } from "vitest"

import type { AuditCreateInput, AuditDb, AuditRow, AuditWhereInput } from "./db"
import { AuditReader, type AuditReaderOptions } from "./reader"
import { createAuditListHandler, createAuditPruneHandler } from "./http"
import {
  recordAudit,
  recordAuditMany,
  recordUserAudit,
  userAuditEntry,
} from "./record"
import {
  auditRetentionCutoff,
  parseRetentionOverride,
  resolveAuditRetention,
} from "./retention"
import { SYSTEM_ACTOR_ID } from "./actions"

function matches(row: AuditRow, where: AuditWhereInput | undefined): boolean {
  if (!where) return true
  if (where.AND) return where.AND.every((part) => matches(row, part))
  if (where.OR) return where.OR.some((part) => matches(row, part))
  if (where.organizationId && row.organizationId !== where.organizationId) {
    return false
  }
  if (where.actorId && row.actorId !== where.actorId) return false
  if (where.action && row.action !== where.action) return false
  if (where.entityType && row.entityType !== where.entityType) return false
  if (where.id) {
    if (typeof where.id === "string") {
      if (row.id !== where.id) return false
    } else {
      if (where.id.in && !where.id.in.includes(row.id)) return false
      if (where.id.lt && !(row.id < where.id.lt)) return false
    }
  }
  if (where.createdAt) {
    const filter =
      where.createdAt instanceof Date
        ? { gte: where.createdAt, lt: where.createdAt }
        : where.createdAt
    if (filter.gte && row.createdAt < filter.gte) return false
    if (filter.lt && row.createdAt >= filter.lt) return false
  }
  return true
}

class FakeDb implements AuditDb {
  rows: AuditRow[] = []
  failWrites = false
  private sequence = 0

  private clone(row: AuditRow): AuditRow {
    return { ...row }
  }

  auditLog = {
    create: async ({ data }: { data: AuditCreateInput }) => {
      if (this.failWrites) throw new Error("audit write failed")
      const row: AuditRow = {
        ...data,
        before: data.before ?? null,
        after: data.after ?? null,
        id: `row_${++this.sequence}`,
        createdAt: new Date(2026, 0, this.sequence),
      }
      this.rows.push(row)
      return row
    },
    createMany: async ({ data }: { data: AuditCreateInput[] }) => {
      if (this.failWrites) throw new Error("audit write failed")
      for (const entry of data) {
        this.rows.push({
          ...entry,
          before: entry.before ?? null,
          after: entry.after ?? null,
          id: `row_${++this.sequence}`,
          createdAt: new Date(2026, 0, this.sequence),
        })
      }
      return { count: data.length }
    },
    findMany: async (args: {
      where?: AuditWhereInput
      orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>
      take?: number
      cursor?: { id: string }
      skip?: number
    }) => {
      let rows = this.rows.filter((row) => matches(row, args.where))
      const order = args.orderBy?.[0]
      if (order && "createdAt" in order) {
        const direction = order.createdAt === "asc" ? 1 : -1
        rows = [...rows].sort(
          (a, b) =>
            direction *
            (a.createdAt.getTime() - b.createdAt.getTime() ||
              a.id.localeCompare(b.id))
        )
      }
      if (args.cursor) {
        const index = rows.findIndex((row) => row.id === args.cursor!.id)
        if (index >= 0) rows = rows.slice(index + (args.skip ?? 0))
      }
      return (args.take ? rows.slice(0, args.take) : rows).map((row) =>
        this.clone(row)
      )
    },
    count: async ({ where }: { where?: AuditWhereInput }) =>
      this.rows.filter((row) => matches(row, where)).length,
    groupBy: async (args: unknown) => {
      const { by, where } = args as {
        by: string[]
        where?: AuditWhereInput
      }
      const rows = this.rows.filter((row) => matches(row, where))
      const key = (row: AuditRow) =>
        by.map((field) => String(row[field as keyof AuditRow])).join("|")
      const groups = new Map<string, AuditRow[]>()
      for (const row of rows) {
        const value = key(row)
        groups.set(value, [...(groups.get(value) ?? []), row])
      }
      return [...groups.values()].map((group) => {
        const row = group[0]!
        return {
          ...(by.includes("action") ? { action: row.action } : {}),
          ...(by.includes("entityType") ? { entityType: row.entityType } : {}),
          ...(by.includes("actorId") ? { actorId: row.actorId } : {}),
          ...(by.includes("actorName") ? { actorName: row.actorName } : {}),
          _count: { _all: group.length },
        }
      })
    },
    deleteMany: async ({ where }: { where?: AuditWhereInput }) => {
      const keep: AuditRow[] = []
      let count = 0
      for (const row of this.rows) {
        if (matches(row, where)) count += 1
        else keep.push(row)
      }
      this.rows = keep
      return { count }
    },
  }
}

function row(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: "row_1",
    organizationId: "org_1",
    actorId: "user_1",
    actorName: "Ada",
    actorEmail: "ada@example.com",
    action: "project.created",
    entityType: "project",
    entityId: "project_1",
    entityLabel: "Project",
    ipAddress: null,
    userAgent: null,
    before: null,
    after: null,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  }
}

const actor = {
  organizationId: "org_1",
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
}
const meta = { ipAddress: "127.0.0.1", userAgent: "vitest" }

describe("@workspace/audit record", () => {
  it("writes one row with the actor and request metadata", async () => {
    const db = new FakeDb()
    await recordUserAudit(
      actor,
      {
        action: "project.created",
        entityType: "project",
        entityId: "project_1",
        entityLabel: "A".repeat(250),
        after: { name: "Project" },
      },
      meta,
      db
    )

    expect(db.rows).toHaveLength(1)
    expect(db.rows[0]).toMatchObject({
      actorId: "user_1",
      actorName: "Ada",
      ipAddress: "127.0.0.1",
      before: null,
      after: { name: "Project" },
    })
    expect(db.rows[0]!.entityLabel).toHaveLength(200)
  })

  it("propagates a failed write so the mutation fails", async () => {
    const db = new FakeDb()
    db.failWrites = true
    await expect(
      recordAudit(
        {
          organizationId: "org_1",
          actorId: SYSTEM_ACTOR_ID,
          action: "organization.deleted",
          entityType: "organization",
          entityId: "org_1",
        },
        db
      )
    ).rejects.toThrow("audit write failed")
  })

  it("does not call the database for an empty bulk write", async () => {
    const db = new FakeDb()
    const spy = vi.spyOn(db.auditLog, "createMany")
    await recordAuditMany([], db)
    expect(spy).not.toHaveBeenCalled()
  })

  it("builds a user entry without touching Next request state", () => {
    expect(
      userAuditEntry(
        actor,
        {
          action: "task.created",
          entityType: "task",
          entityId: "task_1",
        },
        meta
      )
    ).toMatchObject({ organizationId: "org_1", actorId: "user_1" })
  })
})

describe("@workspace/audit reader", () => {
  const rows = [
    row({ id: "row_3", createdAt: new Date("2026-01-03T10:00:00.000Z") }),
    row({ id: "row_2", createdAt: new Date("2026-01-02T10:00:00.000Z") }),
    row({
      id: "row_1",
      action: "task.created",
      entityType: "task",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
    }),
  ]

  function dbWithRows() {
    const db = new FakeDb()
    db.rows = rows.map((entry) => ({ ...entry }))
    return db
  }

  it("paginates with a keyset cursor and keeps the filter", async () => {
    const reader = new AuditReader(dbWithRows())
    const first = await reader.list("org_1", { limit: 2 })
    expect(first.items.map((item) => item.id)).toEqual(["row_3", "row_2"])
    expect(first.nextCursor).not.toBeNull()

    const second = await reader.list("org_1", {
      limit: 2,
      cursor: first.nextCursor,
    })
    expect(second.items.map((item) => item.id)).toEqual(["row_1"])
    expect(second.nextCursor).toBeNull()
  })

  it("filters before paginating", async () => {
    const reader = new AuditReader(dbWithRows())
    const page = await reader.list("org_1", { action: "task.created" })
    expect(page.items.map((item) => item.id)).toEqual(["row_1"])
    expect(page.total).toBe(1)
  })

  it("resolves legacy actor names through the injected lookup", async () => {
    const db = dbWithRows()
    db.rows[0]!.actorName = null
    const options: AuditReaderOptions = {
      actorLookup: async (ids) =>
        new Map(ids.map((id) => [id, { name: "Legacy", email: null }])),
    }
    const page = await new AuditReader(db, options).list("org_1", {})
    expect(page.items[0]!.actorName).toBe("Legacy")
  })

  it("counts facets", async () => {
    const reader = new AuditReader(dbWithRows())
    const facets = await reader.facets("org_1")
    expect(facets.actions).toEqual(
      expect.arrayContaining([{ value: "project.created", count: 2 }])
    )
    expect(facets.entityTypes).toEqual(
      expect.arrayContaining([{ value: "task", count: 1 }])
    )
  })

  it("exports ascending and reports truncation", async () => {
    const reader = new AuditReader(dbWithRows())
    const result = await reader.export("org_1", {}, 2)
    expect(result.entries.map((entry) => entry.id)).toEqual(["row_1", "row_2"])
    expect(result.truncated).toBe(true)
  })

  it("prunes in batches and reports a capped backlog", async () => {
    const db = dbWithRows()
    const reader = new AuditReader(db)
    const result = await reader.prune(
      "org_1",
      new Date("2026-01-03T00:00:00.000Z"),
      { batchSize: 1, maxBatches: 1 }
    )
    expect(result.deleted).toBe(1)
    expect(result.capped).toBe(true)
  })
})

describe("@workspace/audit retention", () => {
  it("treats a running trial as Team", () => {
    expect(
      resolveAuditRetention(
        {
          metadata: '{"plan":"free"}',
          trialEndsAt: new Date("2026-02-01T00:00:00.000Z"),
          subscription: null,
        },
        new Date("2026-01-15T00:00:00.000Z")
      )
    ).toMatchObject({ plan: "team", days: 365, canConfigure: false })
  })

  it("accepts an Enterprise override and clamps it", () => {
    expect(parseRetentionOverride('{"auditRetentionDays":10}')).toBe(30)
    expect(
      resolveAuditRetention({
        metadata: '{"plan":"enterprise","auditRetentionDays":900}',
        trialEndsAt: null,
        subscription: null,
      })
    ).toMatchObject({ plan: "enterprise", days: 900, canConfigure: true })
  })

  it("computes a cutoff", () => {
    expect(
      auditRetentionCutoff(
        30,
        new Date("2026-01-31T00:00:00.000Z")
      ).toISOString()
    ).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("@workspace/audit http", () => {
  function options(db: FakeDb) {
    return {
      app: "copilot",
      db,
      authorizeRead: async () => undefined,
      authorizeWrite: async () => undefined,
    }
  }

  it("lists and maps an authorization error", async () => {
    const db = new FakeDb()
    db.rows = [row()]
    const GET = createAuditListHandler(options(db))
    const response = await GET(
      new Request(
        "https://copilot.example/internal/v1/audit?organizationId=org_1"
      )
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data.items).toHaveLength(1)

    const denied = createAuditListHandler({
      ...options(db),
      authorizeRead: async () => {
        throw Object.assign(new Error("no"), {
          status: 403,
          code: "insufficient_scope",
          message: "No scope",
        })
      },
    })
    expect(
      (await denied(new Request("https://copilot.example/internal/v1/audit")))
        .status
    ).toBe(403)
  })

  it("prunes the requested organizations", async () => {
    const db = new FakeDb()
    db.rows = [row()]
    const POST = createAuditPruneHandler(options(db))
    const response = await POST(
      new Request("https://copilot.example/internal/v1/audit/prune", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizations: [
            { organizationId: "org_1", before: "2026-01-02T00:00:00.000Z" },
          ],
        }),
      })
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data.deleted).toBe(1)
  })
})

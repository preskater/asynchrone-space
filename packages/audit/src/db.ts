/** A row as stored in any app's `AuditLog` table. */
export interface AuditRow {
  id: string
  organizationId: string
  actorId: string
  actorName: string | null
  actorEmail: string | null
  action: string
  entityType: string
  entityId: string
  entityLabel: string | null
  ipAddress: string | null
  userAgent: string | null
  before: unknown
  after: unknown
  createdAt: Date
}

/** JSON value accepted by Prisma's `InputJsonValue`. */
export type AuditJsonValue =
  | string
  | number
  | boolean
  | AuditJsonValue[]
  | { [key: string]: AuditJsonValue }

export interface AuditCreateInput {
  organizationId: string
  actorId: string
  actorName: string | null
  actorEmail: string | null
  action: string
  entityType: string
  entityId: string
  entityLabel: string | null
  ipAddress: string | null
  userAgent: string | null
  before?: AuditJsonValue
  after?: AuditJsonValue
}

export interface AuditWhereInput {
  organizationId?: string
  actorId?: string
  action?: string
  entityType?: string
  createdAt?: Date | { gte?: Date; lt?: Date }
  id?: string | { in?: string[]; lt?: string }
  AND?: AuditWhereInput[]
  OR?: AuditWhereInput[]
}

export interface AuditFindManyArgs {
  where?: AuditWhereInput
  orderBy?: Array<{ createdAt: "asc" | "desc" } | { id: "asc" | "desc" }>
  take?: number
  select?: Record<string, boolean>
  cursor?: { id: string }
  skip?: number
}

export interface AuditGroupRow {
  actorId?: string
  actorName?: string | null
  action?: string
  entityType?: string
  _count: { _all: number }
}

/**
 * The slice of a generated Prisma client the audit package needs. Every
 * per-app client is structurally compatible, and unit tests can pass a fake.
 */
export interface AuditDb {
  auditLog: {
    create(args: { data: AuditCreateInput }): PromiseLike<unknown>
    createMany(args: {
      data: AuditCreateInput[]
    }): PromiseLike<{ count: number }>
    findMany(args: AuditFindManyArgs): PromiseLike<AuditRow[]>
    count(args: { where?: AuditWhereInput }): PromiseLike<number>
    // Prisma's generic `groupBy` is not structurally assignable with a literal
    // `by` union; the reader casts the grouped rows to `AuditGroupRow[]`.
    groupBy(args: unknown): PromiseLike<unknown>
    deleteMany(args: {
      where?: AuditWhereInput
    }): PromiseLike<{ count: number }>
  }
}

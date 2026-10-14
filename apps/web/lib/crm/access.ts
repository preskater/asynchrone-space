import type { RequestContext } from "@/lib/core/context"
import { roleRank } from "@/lib/organization/roles"

export interface CrmAccess {
  rank: number
  /** Member and above: create, edit, archive and restore records. */
  canEdit: boolean
  /** Admin and above: pipelines, custom field configuration. */
  canManage: boolean
  /** Member and above: CSV import/export. */
  canExport: boolean
}

export function resolveCrmAccess(ctx: RequestContext): CrmAccess {
  const rank = roleRank(ctx.role)
  return {
    rank,
    canEdit: rank >= 2,
    canManage: rank >= 3,
    canExport: rank >= 2,
  }
}

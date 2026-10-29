/**
 * Plan → entitlements, the single source of truth for what each plan includes.
 * Dependency-free so both the customer app and the control tower can import it.
 */
export type OrgPlan = "free" | "team" | "enterprise"

export const ORG_PLANS: OrgPlan[] = ["free", "team", "enterprise"]

export type Entitlement =
  | "seats"
  | "storageBytes"
  | "aiTokensPerMonth"
  | "auditLog"
  | "sso"
  | "scim"
  | "granularPermissions"
  | "apiAccess"

export type Entitlements = {
  seats: number
  storageBytes: number
  // ponytail: only `> 0` is enforced (AI on/off); monthly metering lands with billing.
  aiTokensPerMonth: number
  auditLog: boolean
  sso: boolean
  scim: boolean
  granularPermissions: boolean
  apiAccess: boolean
}

const GB = 1024 * 1024 * 1024

const ENTITLEMENTS: Record<OrgPlan, Entitlements> = {
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

export function entitlementsFor(plan: OrgPlan): Entitlements {
  return ENTITLEMENTS[plan]
}

/** Numeric limits count as enabled when above zero. */
export function hasEntitlement(
  entitlements: Entitlements,
  entitlement: Entitlement
): boolean {
  return Boolean(entitlements[entitlement])
}

/** Reads `plan` from organization metadata; anything missing or unknown is `free`. */
export function parsePlan(metadata: string | null | undefined): OrgPlan {
  if (!metadata) return "free"
  try {
    const parsed = JSON.parse(metadata) as { plan?: unknown }
    if (ORG_PLANS.includes(parsed.plan as OrgPlan)) {
      return parsed.plan as OrgPlan
    }
  } catch {
    // Organization metadata also holds appearance settings; ignore bad JSON.
  }
  return "free"
}

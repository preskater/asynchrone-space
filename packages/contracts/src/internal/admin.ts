import { z } from "zod"

/**
 * Control-tower administration contracts.
 *
 * These endpoints are hosted by Copilot (which owns identity) and called by the
 * control tower with `internal:identity:admin`. Platform mutations remain the
 * caller's responsibility to audit in `PlatformAuditEvent`.
 */

export const AdminOrganizationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  slug: z.string().min(1),
  plan: z.enum(["free", "team", "enterprise"]),
  subscriptionStatus: z.string().nullable(),
  manualOverride: z.boolean(),
  trialEndsAt: z.string().datetime().nullable(),
  deletionScheduledAt: z.string().datetime().nullable(),
  memberCount: z.number().int().nonnegative(),
  storageQuotaBytes: z.string().nullable(),
  createdAt: z.string().datetime(),
})
export type AdminOrganization = z.infer<typeof AdminOrganizationSchema>

export const AdminOrganizationPageSchema = z.object({
  items: z.array(AdminOrganizationSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
})
export type AdminOrganizationPage = z.infer<typeof AdminOrganizationPageSchema>

export const AdminUserSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  role: z.string().nullable(),
  banned: z.boolean(),
  banReason: z.string().nullable(),
  twoFactorEnabled: z.boolean(),
  createdAt: z.string().datetime(),
})
export type AdminUser = z.infer<typeof AdminUserSchema>

export const AdminUserPageSchema = z.object({
  items: z.array(AdminUserSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
})
export type AdminUserPage = z.infer<typeof AdminUserPageSchema>

export const AdminPlanInputSchema = z.object({
  plan: z.enum(["free", "team", "enterprise"]),
  quotaBytes: z.number().int().positive().nullable(),
})
export type AdminPlanInput = z.infer<typeof AdminPlanInputSchema>

export const AdminTrialInputSchema = z.object({
  /** End the trial now instead of starting one. */
  end: z.boolean().default(false),
  days: z.number().int().min(1).max(365).default(14),
})
export type AdminTrialInput = z.infer<typeof AdminTrialInputSchema>

export const AdminBanInputSchema = z.object({
  banned: z.boolean(),
  reason: z.string().trim().max(500).optional(),
})
export type AdminBanInput = z.infer<typeof AdminBanInputSchema>

export const AdminHandoffInputSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1).optional(),
  /** Control-tower operator starting the impersonation. */
  actorId: z.string().min(1).optional(),
})
export type AdminHandoffInput = z.infer<typeof AdminHandoffInputSchema>

export const AdminSessionRevokeResultSchema = z.object({
  deleted: z.number().int().nonnegative(),
})
export type AdminSessionRevokeResult = z.infer<
  typeof AdminSessionRevokeResultSchema
>

export const AdminHandoffResultSchema = z.object({
  /** Single-use handoff URL on the customer app. */
  url: z.string().url(),
})
export type AdminHandoffResult = z.infer<typeof AdminHandoffResultSchema>

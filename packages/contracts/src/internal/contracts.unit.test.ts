import { describe, expect, it } from "vitest"

import {
  AuditPageSchema,
  AuditQuerySchema,
  DeletionResultSchema,
  ExportManifestSchema,
  INTERNAL_API_VERSION,
  INTERNAL_BASE_PATH,
  INTERNAL_ROUTES,
  MemberSchema,
  NotificationInputSchema,
  OrganizationSchema,
  ServiceTokenClaimsSchema,
  internalEnvelope,
  internalPath,
} from "../index"

describe("internal paths", () => {
  it("versions every internal path", () => {
    expect(INTERNAL_API_VERSION).toBe("v1")
    expect(INTERNAL_BASE_PATH).toBe("/internal/v1")
    expect(internalPath()).toBe("/internal/v1")
    expect(internalPath("/organizations/", "/acme")).toBe(
      "/internal/v1/organizations/acme"
    )
  })

  it("builds the identity and resource routes", () => {
    expect(INTERNAL_ROUTES.identityMembers("org_1")).toBe(
      "/internal/v1/organizations/org_1/members"
    )
    expect(INTERNAL_ROUTES.identityEntitlements("org_1")).toBe(
      "/internal/v1/organizations/org_1/entitlements"
    )
    expect(INTERNAL_ROUTES.deleteUser("user_1")).toBe(
      "/internal/v1/users/user_1"
    )
  })
})

describe("identity contracts", () => {
  it("accepts a member and preserves the client flag", () => {
    const member = MemberSchema.parse({
      id: "user_1",
      name: "Ada",
      email: "ada@example.com",
      role: "owner",
      clientId: null,
    })
    expect(member.role).toBe("owner")
    expect(member.clientId).toBeNull()
  })

  it("rejects an unknown role", () => {
    expect(() =>
      MemberSchema.parse({
        id: "user_1",
        name: "Ada",
        email: "ada@example.com",
        role: "superadmin",
      })
    ).toThrow()
  })

  it("validates an organization and a service token", () => {
    expect(
      OrganizationSchema.parse({ id: "org_1", name: "Acme", slug: "acme" })
    ).toEqual({ id: "org_1", name: "Acme", slug: "acme" })

    expect(
      ServiceTokenClaimsSchema.parse({
        iss: "https://copilot.asynchrone.space",
        sub: "projects",
        aud: "urn:asynchrone:app:projects",
        scope: "internal:identity:read",
        exp: 1_900_000_000,
        client_id: "projects",
      })
    ).toMatchObject({ sub: "projects" })
  })
})

describe("resource contracts", () => {
  it("defaults audit pagination", () => {
    expect(AuditQuerySchema.parse({ organizationId: "org_1" }).limit).toBe(50)
    expect(
      AuditPageSchema.parse({ events: [], nextCursor: null }).nextCursor
    ).toBeNull()
  })

  it("requires an idempotency key for notifications", () => {
    expect(() =>
      NotificationInputSchema.parse({
        organizationId: "org_1",
        userId: "user_1",
        type: "task.assigned",
        title: "Assigned",
      })
    ).toThrow()
  })

  it("validates export manifests and deletion results", () => {
    const manifest = ExportManifestSchema.parse({
      app: "projects",
      appVersion: "1.0.0",
      schemaVersion: "2026-10-31",
      generatedAt: "2026-10-31T00:00:00.000Z",
      tables: { project: 3, task: 12 },
    })
    expect(manifest.tables.task).toBe(12)

    const result = DeletionResultSchema.parse({
      app: "projects",
      organizationId: "org_1",
      deleted: { task: 12 },
      completedAt: "2026-10-31T00:00:00.000Z",
    })
    expect(result.deleted.task).toBe(12)
  })

  it("wraps data in a versioned envelope", () => {
    const schema = internalEnvelope(OrganizationSchema)
    expect(
      schema.parse({
        data: { id: "org_1", name: "Acme", slug: "acme" },
        meta: {
          app: "copilot",
          version: "v1",
          requestId: "req_1",
        },
      }).data.slug
    ).toBe("acme")
  })
})

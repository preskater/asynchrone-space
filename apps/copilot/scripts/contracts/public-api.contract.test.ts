import { randomUUID } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  apiTokenActorId,
  authenticatePublicApi,
  createApiToken,
  hashApiToken,
  listApiTokens,
  revokeApiToken,
} from "@/lib/public-api"
import { prisma } from "@/lib/prisma"
import {
  enqueueWebhookEvent,
  listWebhookDeliveries,
  replayWebhookDelivery,
} from "@/lib/webhooks"

import { createContractFixture } from "./fixtures"

function apiRequest(token: string, organization?: string) {
  return new Request("http://localhost/api/v1/projects", {
    headers: {
      authorization: `Bearer ${token}`,
      ...(organization ? { "x-asynchrone-organization": organization } : {}),
    },
  })
}

describe("public API contract", () => {
  it("authenticates a stored hash and keeps every request inside one organization", async () => {
    const fixture = await createContractFixture()
    try {
      const created = await createApiToken(fixture.ctxAlice, {
        name: "CI token",
        scopes: ["projects:read"],
      })
      expect(created.token.startsWith("async_")).toBe(true)

      const row = await prisma.apiToken.findUnique({
        where: { hashedToken: hashApiToken(created.token) },
        select: {
          id: true,
          organizationId: true,
          createdById: true,
          scopes: true,
        },
      })
      expect(row).toMatchObject({
        organizationId: fixture.orgA,
        createdById: fixture.users.alice,
        scopes: ["projects:read"],
      })

      const listed = await listApiTokens(fixture.ctxAlice)
      expect(JSON.stringify(listed)).not.toContain(created.token)

      const ctx = await authenticatePublicApi(
        apiRequest(created.token, fixture.orgA),
        "req_contract",
        "projects:read"
      )
      expect(ctx.organization.id).toBe(fixture.orgA)
      expect(ctx.actor).toEqual({
        id: apiTokenActorId(row!.id),
        name: "CI token",
        email: `${fixture.users.alice}@contract.local`,
      })

      await expect(
        authenticatePublicApi(
          apiRequest(created.token, fixture.slugA),
          "req_slug",
          "projects:read"
        )
      ).resolves.toMatchObject({ organization: { id: fixture.orgA } })

      await expect(
        authenticatePublicApi(
          apiRequest(created.token, fixture.orgB),
          "req_other_org",
          "projects:read"
        )
      ).rejects.toMatchObject({ code: "organization_mismatch", status: 403 })
      await expect(
        authenticatePublicApi(
          apiRequest(created.token, fixture.slugB),
          "req_other_slug",
          "projects:read"
        )
      ).rejects.toMatchObject({ code: "organization_mismatch", status: 403 })

      await expect(
        authenticatePublicApi(
          apiRequest(created.token),
          "req_scope",
          "tasks:read"
        )
      ).rejects.toMatchObject({ code: "insufficient_scope", status: 403 })

      await revokeApiToken(fixture.ctxAlice, created.item.id)
      await expect(
        authenticatePublicApi(
          apiRequest(created.token),
          "req_revoked",
          "projects:read"
        )
      ).rejects.toMatchObject({ code: "revoked_token", status: 401 })

      await expect(
        revokeApiToken(fixture.ctxMallory, created.item.id)
      ).rejects.toMatchObject({ code: "not_found" })
    } finally {
      await fixture.cleanup()
    }
  })
})

describe("webhook delivery contract", () => {
  it("enqueues, lists and replays deliveries without crossing organizations", async () => {
    const fixture = await createContractFixture()
    try {
      const subscription = await prisma.webhookSubscription.create({
        data: {
          organizationId: fixture.orgA,
          url: "https://example.com/hooks",
          // Not used by the enqueue path; delivery needs a public network.
          secret: "contract-unused-secret",
          events: ["member.added"],
          createdById: fixture.users.alice,
        },
        select: { id: true },
      })

      const eventId = randomUUID()
      const count = await enqueueWebhookEvent({
        id: eventId,
        type: "member.added",
        occurredAt: new Date().toISOString(),
        organizationId: fixture.orgA,
        data: {
          member: {
            userId: fixture.users.bob,
            name: "Bob",
            email: `${fixture.users.bob}@contract.local`,
            role: "member",
          },
        },
      })
      expect(count).toBe(1)

      const page = await listWebhookDeliveries(
        { organizationId: fixture.orgA },
        { limit: 10 }
      )
      const delivery = page.items.find((item) => item.eventId === eventId)
      expect(delivery).toMatchObject({
        subscriptionId: subscription.id,
        eventType: "member.added",
        status: "pending",
        attempts: 0,
        url: "https://example.com/hooks",
      })
      expect(
        (await listWebhookDeliveries({ organizationId: fixture.orgB })).items
      ).toHaveLength(0)
      expect(
        (
          await listWebhookDeliveries(
            { organizationId: fixture.orgA },
            { subscriptionId: randomUUID() }
          )
        ).items
      ).toHaveLength(0)

      await prisma.webhookDelivery.update({
        where: { id: delivery!.id },
        data: {
          status: "failed",
          attempts: 7,
          lastError: "HTTP 500",
          lastStatusCode: 500,
          completedAt: new Date(),
        },
      })

      await expect(
        replayWebhookDelivery(fixture.ctxMallory, delivery!.id)
      ).rejects.toMatchObject({ code: "not_found" })
      await replayWebhookDelivery(fixture.ctxAlice, delivery!.id)

      const replayed = await prisma.webhookDelivery.findUnique({
        where: { id: delivery!.id },
      })
      expect(replayed).toMatchObject({
        status: "pending",
        attempts: 0,
        replayCount: 1,
        lastError: null,
        lastStatusCode: null,
        completedAt: null,
      })
    } finally {
      await fixture.cleanup()
    }
  })
})

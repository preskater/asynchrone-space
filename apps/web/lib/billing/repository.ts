import { Prisma, prisma } from "@workspace/db"

import type { BillingRepositoryPort } from "./types"

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

export class BillingRepository implements BillingRepositoryPort {
  async getOrganization(organizationId: string) {
    return prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        metadata: true,
        storageQuotaBytes: true,
      },
    })
  }

  async getOrganizationIdByCustomer(
    customerId: string
  ): Promise<string | null> {
    const subscription = await prisma.subscription.findFirst({
      where: { providerCustomerId: customerId },
      select: { organizationId: true },
    })
    return subscription?.organizationId ?? null
  }

  async getSubscriptionByOrganization(organizationId: string) {
    return prisma.subscription.findUnique({
      where: { organizationId },
      select: {
        id: true,
        organizationId: true,
        plan: true,
        status: true,
        provider: true,
        providerCustomerId: true,
        providerSubscriptionId: true,
        providerPriceId: true,
        billingInterval: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
        trialEndsAt: true,
        manualOverride: true,
      },
    })
  }

  async upsertSubscription(
    input: Parameters<BillingRepositoryPort["upsertSubscription"]>[0]
  ): Promise<void> {
    const { organizationId, ...data } = input
    await prisma.subscription.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    })
  }

  async setCustomerId(organizationId: string, customerId: string) {
    await prisma.subscription.upsert({
      where: { organizationId },
      create: { organizationId, providerCustomerId: customerId },
      update: { providerCustomerId: customerId },
    })
  }

  async recordEvent(
    input: Parameters<BillingRepositoryPort["recordEvent"]>[0]
  ): Promise<"recorded" | "duplicate"> {
    try {
      await prisma.billingEvent.create({
        data: {
          provider: input.provider,
          eventId: input.eventId,
          type: input.type,
          organizationId: input.organizationId,
          status: input.status ?? "processed",
          error: input.error ?? null,
        },
      })
      return "recorded"
    } catch (error) {
      if (isUniqueViolation(error)) return "duplicate"
      throw error
    }
  }

  async markEvent(
    input: Parameters<BillingRepositoryPort["markEvent"]>[0]
  ): Promise<void> {
    await prisma.billingEvent.updateMany({
      where: { provider: input.provider, eventId: input.eventId },
      data: {
        status: input.status,
        error: input.error ?? null,
        ...(input.organizationId
          ? { organizationId: input.organizationId }
          : {}),
      },
    })
  }

  async upsertInvoice(
    input: Parameters<BillingRepositoryPort["upsertInvoice"]>[0]
  ): Promise<void> {
    const { providerInvoiceId, ...data } = input
    await prisma.invoice.upsert({
      where: { providerInvoiceId },
      create: { providerInvoiceId, ...data },
      update: data,
    })
  }

  async listInvoices(organizationId: string, limit: number) {
    return prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        number: true,
        status: true,
        amountDue: true,
        amountPaid: true,
        currency: true,
        hostedInvoiceUrl: true,
        invoicePdf: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
        createdAt: true,
      },
    })
  }

  async sumUsedBytes(organizationId: string): Promise<number> {
    const result = await prisma.fileNode.aggregate({
      where: { organizationId, trashed: false },
      _sum: { sizeBytes: true },
    })
    return result._sum.sizeBytes ?? 0
  }

  async listOwnerRecipients(organizationId: string) {
    const members = await prisma.member.findMany({
      where: {
        organizationId,
        clientId: null,
        role: { contains: "owner" },
      },
      select: {
        userId: true,
        user: { select: { email: true, name: true } },
      },
    })
    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      name: member.user.name,
    }))
  }
}

import {
  PublicClientSchema,
  PublicContactSchema,
  PublicDealSchema,
  type PublicClient,
  type PublicContact,
  type PublicDeal,
} from "@workspace/contracts"
import type {
  ClientContactData,
  ClientData,
  ClientDealData,
} from "@workspace/clients/types"

/** The public API and the webhook emitter share these mappers. */
export function publicClient(client: ClientData): PublicClient {
  return PublicClientSchema.parse({
    id: client.id,
    name: client.name,
    status: client.status,
    contactEmail: client.contactEmail ?? null,
    industry: client.industry ?? null,
    website: client.website ?? null,
    phone: client.phone ?? null,
    address: client.address ?? null,
    description: client.description ?? null,
    source: client.source ?? null,
    ownerId: client.ownerId ?? null,
    isActive: client.isActive,
    archivedAt: client.archivedAt ?? null,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  })
}

export function publicContact(contact: ClientContactData): PublicContact {
  return PublicContactSchema.parse({
    id: contact.id,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? null,
    phone: contact.phone ?? null,
    jobTitle: contact.jobTitle ?? null,
    notes: contact.notes ?? null,
    ownerId: contact.ownerId ?? null,
    companyIds: contact.companies.map((company) => company.clientId),
    archivedAt: contact.archivedAt ?? null,
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  })
}

export function publicDeal(deal: ClientDealData): PublicDeal {
  return PublicDealSchema.parse({
    id: deal.id,
    name: deal.name,
    clientId: deal.clientId ?? null,
    pipelineId: deal.pipelineId ?? null,
    stageId: deal.stageId ?? null,
    stageName: deal.stageName ?? null,
    stageType: deal.stageType ?? null,
    amount: deal.amount,
    currency: deal.currency,
    probability: deal.probability,
    status: deal.status,
    expectedCloseDate: deal.expectedCloseDate ?? null,
    actualCloseDate: deal.actualCloseDate ?? null,
    lossReason: deal.lossReason ?? null,
    source: deal.source ?? null,
    description: deal.description ?? null,
    ownerId: deal.ownerId ?? null,
    contactIds: deal.contacts.map((contact) => contact.contactId),
    archivedAt: deal.archivedAt ?? null,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
  })
}

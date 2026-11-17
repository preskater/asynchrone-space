import { z } from "zod"

import { AUDIT_ACTIONS } from "@workspace/audit"
import {
  DomainPageInputSchema,
  PublicCreateClientSchema,
  PublicCreateContactSchema,
  PublicCreateDealSchema,
  PublicMoveDealSchema,
  PublicUpdateClientSchema,
  PublicUpdateContactSchema,
  PublicUpdateDealSchema,
  type DelegatedContext,
  type DomainCall,
  type DomainOperation,
  type ProjectFeedbackRelease,
} from "@workspace/contracts"
import { appOrigin } from "@workspace/contracts/server"
import type { RequestContext } from "@workspace/core/context"
import { rolesFrom } from "@workspace/core/roles"
import { ForbiddenError, NotFoundError } from "@workspace/core/errors"
import { routing } from "@workspace/i18n/routing"
import {
  activityInputSchema,
  clientInputSchema,
  contactInputSchema,
  dealInputSchema,
  linkDocumentSchema,
  linkProjectSchema,
  moveDealSchema,
  unlinkProjectSchema,
} from "@workspace/clients/schemas"

import { clientsService } from "@/lib/clients"
import { clientFiles } from "@/lib/clients/ports"

import { publicClient, publicContact, publicDeal } from "./public-resources"
import { identity, memberDirectory } from "@/lib/identity"
import { recordUserAudit } from "@/lib/audit"
import { prisma } from "@/lib/prisma"

function requestContext(context: DelegatedContext): RequestContext {
  return {
    userId: context.userId,
    userName: context.userName,
    userEmail: context.userEmail,
    organizationId: context.organizationId,
    roles: rolesFrom(context),
    actor: context.actor ?? undefined,
  }
}

const idInput = z.object({ id: z.string().min(1) })
const documentEntityInput = z.object({
  entity: z.enum(["client", "contact", "deal"]),
  entityId: z.string().min(1),
})
const portalDocumentInput = z.object({
  fileId: z.string().min(1),
  name: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
})

const clientBasicsInput = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(200),
  contactEmail: z.string().email().nullable().optional(),
  isActive: z.boolean(),
})

function portalClientId(context: DelegatedContext): string {
  const clientId = context.portal?.clientId
  if (!clientId)
    throw new ForbiddenError("A portal client context is required.")
  return clientId
}

export async function dispatchDomain(
  operation: DomainOperation,
  call: DomainCall
): Promise<unknown> {
  const ctx = requestContext(call.context)

  switch (operation) {
    case "list-client-directory": {
      return prisma.client.findMany({
        where: { organizationId: ctx.organizationId },
        select: {
          id: true,
          name: true,
          contactEmail: true,
          isActive: true,
        },
        orderBy: { name: "asc" },
      })
    }
    case "save-client-basics": {
      const input = clientBasicsInput.parse(call.input)
      const data = {
        name: input.name,
        contactEmail: input.contactEmail ?? null,
        isActive: input.isActive,
      }
      const row = input.id
        ? await prisma.client.update({ where: { id: input.id }, data })
        : await prisma.client.create({
            data: { ...data, organizationId: ctx.organizationId },
          })
      return {
        id: row.id,
        name: row.name,
        contactEmail: row.contactEmail,
        isActive: row.isActive,
      }
    }
    case "get-clients-overview":
      return clientsService.getOverview(ctx)
    case "list-clients-page": {
      const page = await clientsService.listClientsPage(
        ctx,
        DomainPageInputSchema.parse(call.input)
      )
      return {
        items: page.items.map(publicClient),
        nextCursor: page.nextCursor,
      }
    }
    case "get-client":
      return clientsService.getClientDetail(ctx, idInput.parse(call.input).id)
    case "get-public-client": {
      const detail = await clientsService.getClientDetail(
        ctx,
        idInput.parse(call.input).id
      )
      return publicClient(detail.client)
    }
    case "public-create-client": {
      const input = PublicCreateClientSchema.parse(call.input)
      return publicClient(
        await clientsService.saveClient(ctx, clientInputSchema.parse(input))
      )
    }
    case "public-update-client": {
      const { id } = idInput.parse(call.input)
      const patch = PublicUpdateClientSchema.parse(call.input)
      const current = (await clientsService.getClientDetail(ctx, id)).client
      const input = clientInputSchema.parse({
        id,
        name: patch.name ?? current.name,
        status: patch.status ?? current.status,
        industry:
          patch.industry !== undefined
            ? patch.industry
            : (current.industry ?? null),
        website:
          patch.website !== undefined
            ? patch.website
            : (current.website ?? null),
        phone:
          patch.phone !== undefined ? patch.phone : (current.phone ?? null),
        address:
          patch.address !== undefined
            ? patch.address
            : (current.address ?? null),
        description:
          patch.description !== undefined
            ? patch.description
            : (current.description ?? null),
        source:
          patch.source !== undefined ? patch.source : (current.source ?? null),
        ownerId:
          patch.ownerId !== undefined
            ? patch.ownerId
            : (current.ownerId ?? null),
        contactEmail:
          patch.contactEmail !== undefined
            ? patch.contactEmail
            : (current.contactEmail ?? null),
        isActive: patch.isActive ?? current.isActive,
        customFields: current.customFields,
      })
      return publicClient(await clientsService.saveClient(ctx, input))
    }
    case "list-contacts-page": {
      const page = await clientsService.listContactsPage(
        ctx,
        DomainPageInputSchema.parse(call.input)
      )
      return {
        items: page.items.map(publicContact),
        nextCursor: page.nextCursor,
      }
    }
    case "get-contact": {
      const detail = await clientsService.getContactDetail(
        ctx,
        idInput.parse(call.input).id
      )
      return publicContact(detail.contact)
    }
    case "public-create-contact": {
      const input = PublicCreateContactSchema.parse(call.input)
      return publicContact(
        await clientsService.saveContact(
          ctx,
          contactInputSchema.parse({
            firstName: input.firstName,
            lastName: input.lastName ?? "",
            email: input.email,
            phone: input.phone,
            jobTitle: input.jobTitle,
            notes: input.notes,
            ownerId: input.ownerId,
            companies: (input.clientIds ?? []).map((clientId) => ({
              clientId,
              jobTitle: null,
              isPrimary: false,
            })),
          })
        )
      )
    }
    case "public-update-contact": {
      const { id } = idInput.parse(call.input)
      const patch = PublicUpdateContactSchema.parse(call.input)
      const current = (await clientsService.getContactDetail(ctx, id)).contact
      const companies =
        patch.clientIds === undefined
          ? current.companies.map((company) => ({
              clientId: company.clientId,
              jobTitle: company.jobTitle ?? null,
              isPrimary: company.isPrimary,
            }))
          : patch.clientIds.map((clientId) => {
              const existing = current.companies.find(
                (company) => company.clientId === clientId
              )
              return {
                clientId,
                jobTitle: existing?.jobTitle ?? null,
                isPrimary: existing?.isPrimary ?? false,
              }
            })
      const input = contactInputSchema.parse({
        id,
        firstName: patch.firstName ?? current.firstName,
        lastName: patch.lastName ?? current.lastName,
        email:
          patch.email !== undefined ? patch.email : (current.email ?? null),
        phone:
          patch.phone !== undefined ? patch.phone : (current.phone ?? null),
        jobTitle:
          patch.jobTitle !== undefined
            ? patch.jobTitle
            : (current.jobTitle ?? null),
        notes:
          patch.notes !== undefined ? patch.notes : (current.notes ?? null),
        ownerId:
          patch.ownerId !== undefined
            ? patch.ownerId
            : (current.ownerId ?? null),
        customFields: current.customFields,
        companies,
      })
      return publicContact(await clientsService.saveContact(ctx, input))
    }
    case "list-deals-page": {
      const page = await clientsService.listDealsPage(
        ctx,
        DomainPageInputSchema.parse(call.input)
      )
      return {
        items: page.items.map(publicDeal),
        nextCursor: page.nextCursor,
      }
    }
    case "get-deal":
      return clientsService.getDealDetail(ctx, idInput.parse(call.input).id)
    case "get-public-deal": {
      const detail = await clientsService.getDealDetail(
        ctx,
        idInput.parse(call.input).id
      )
      return publicDeal(detail.deal)
    }
    case "public-create-deal": {
      const input = PublicCreateDealSchema.parse(call.input)
      return publicDeal(
        await clientsService.saveDeal(ctx, dealInputSchema.parse(input))
      )
    }
    case "public-update-deal": {
      const { id } = idInput.parse(call.input)
      const patch = PublicUpdateDealSchema.parse(call.input)
      const current = (await clientsService.getDealDetail(ctx, id)).deal
      const input = dealInputSchema.parse({
        id,
        name: patch.name ?? current.name,
        clientId:
          patch.clientId !== undefined
            ? patch.clientId
            : (current.clientId ?? null),
        pipelineId:
          patch.pipelineId !== undefined
            ? patch.pipelineId
            : (current.pipelineId ?? null),
        stageId:
          patch.stageId !== undefined
            ? patch.stageId
            : (current.stageId ?? null),
        amount: patch.amount ?? current.amount,
        currency: patch.currency ?? current.currency,
        probability: patch.probability ?? current.probability,
        expectedCloseDate:
          patch.expectedCloseDate !== undefined
            ? patch.expectedCloseDate
            : (current.expectedCloseDate ?? null),
        source:
          patch.source !== undefined ? patch.source : (current.source ?? null),
        description:
          patch.description !== undefined
            ? patch.description
            : (current.description ?? null),
        ownerId:
          patch.ownerId !== undefined
            ? patch.ownerId
            : (current.ownerId ?? null),
        customFields: current.customFields,
        contactIds:
          patch.contactIds ??
          current.contacts.map((contact) => contact.contactId),
      })
      return publicDeal(await clientsService.saveDeal(ctx, input))
    }
    case "public-move-deal": {
      const { id } = idInput.parse(call.input)
      const input = PublicMoveDealSchema.parse(call.input)
      return publicDeal(
        await clientsService.moveDeal(
          ctx,
          moveDealSchema.parse({
            dealId: id,
            stageId: input.stageId,
            position: input.position,
            lossReason: input.lossReason,
          })
        )
      )
    }
    case "save-client":
      return clientsService.saveClient(ctx, clientInputSchema.parse(call.input))
    case "save-contact":
      return clientsService.saveContact(
        ctx,
        contactInputSchema.parse(call.input)
      )
    case "save-deal":
      return clientsService.saveDeal(ctx, dealInputSchema.parse(call.input))
    case "move-deal":
      return clientsService.moveDeal(ctx, moveDealSchema.parse(call.input))
    case "create-client-activity":
      return clientsService.createActivity(
        ctx,
        activityInputSchema.parse(call.input)
      )
    case "list-client-documents": {
      const input = documentEntityInput.parse(call.input)
      return clientsService.listDocuments(ctx, input.entity, input.entityId)
    }
    case "link-client-document":
      return clientsService.linkDocument(
        ctx,
        linkDocumentSchema.parse(call.input)
      )
    case "unlink-client-document":
      return clientsService.unlinkDocument(ctx, idInput.parse(call.input).id)
    case "link-client-project":
      return clientsService.linkProject(
        ctx,
        linkProjectSchema.parse(call.input)
      )
    case "unlink-client-project":
      return clientsService.unlinkProject(
        ctx,
        unlinkProjectSchema.parse(call.input)
      )
    case "list-project-feedback": {
      // Internal members only: portal reports go through the portal operations.
      if (call.context.portal) throw new ForbiddenError()
      const { projectId } = z
        .object({ projectId: z.string().min(1) })
        .parse(call.input)
      const [groups, organization] = await Promise.all([
        clientsService.listReleaseGroups(ctx, { projectId }),
        identity.getOrganization(ctx.organizationId),
      ])
      const base = `${appOrigin("clients")}/${routing.defaultLocale}/${organization.slug}`
      return groups.map(({ release, feedback }): ProjectFeedbackRelease => ({
        id: release.id,
        clientId: release.clientId,
        clientName: release.clientName ?? "",
        version: release.version,
        label: release.label,
        releasedAt: release.releasedAt,
        status: release.status,
        openCount: release.openCount,
        feedbackCount: release.feedbackCount,
        url: `${base}/clients/${release.clientId}/feedback`,
        feedback: feedback.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          category: item.category,
          impact: item.impact,
          testedAt: item.testedAt,
          contactName: item.contactName,
          linkedTaskId: item.linkedTaskId,
        })),
      }))
    }
    case "portal-list-release-reports":
      return clientsService.listPortalReleases(
        ctx,
        portalClientId(call.context)
      )
    case "portal-get-release-report": {
      const { releaseId } = z
        .object({ releaseId: z.string().min(1) })
        .parse(call.input)
      return clientsService.getPortalReleaseReport(
        ctx,
        portalClientId(call.context),
        releaseId
      )
    }
    case "portal-get-client": {
      const clientId = portalClientId(call.context)
      return prisma.client.findFirst({
        where: { id: clientId, organizationId: ctx.organizationId },
        select: { id: true, name: true, ownerId: true },
      })
    }
    case "portal-list-documents": {
      const clientId = portalClientId(call.context)
      const links = await prisma.clientDocument.findMany({
        where: {
          organizationId: ctx.organizationId,
          entity: "client",
          entityId: clientId,
          visibility: "client",
        },
        select: {
          id: true,
          fileId: true,
          addedBy: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      })
      const [files, members] = await Promise.all([
        clientFiles.byIds(
          ctx,
          links.map((link) => link.fileId)
        ),
        memberDirectory.list(ctx.organizationId),
      ])
      const fileById = new Map(files.map((file) => [file.id, file]))
      const nameById = new Map(
        members.map((member) => [member.userId, member.name])
      )
      return links.flatMap((link) => {
        const file = fileById.get(link.fileId)
        if (!file || file.trashed) return []
        return [
          {
            id: link.id,
            fileId: link.fileId,
            name: file.name,
            sizeBytes: file.sizeBytes ?? undefined,
            createdAt: link.createdAt.toISOString(),
            addedByName: nameById.get(link.addedBy),
          },
        ]
      })
    }
    case "portal-get-document": {
      const clientId = portalClientId(call.context)
      const { fileId } = z
        .object({ fileId: z.string().min(1) })
        .parse(call.input)
      const link = await prisma.clientDocument.findFirst({
        where: {
          organizationId: ctx.organizationId,
          entity: "client",
          entityId: clientId,
          visibility: "client",
          fileId,
        },
        select: { id: true },
      })
      if (!link) return null
      const file = await clientFiles.find(ctx, fileId)
      if (!file) return null
      return {
        name: file.name,
        mimeType: file.mimeType ?? undefined,
        trashed: file.trashed,
        sizeBytes: file.sizeBytes ?? undefined,
      }
    }
    case "portal-create-document": {
      const clientId = portalClientId(call.context)
      const input = portalDocumentInput.parse(call.input)
      const link = await prisma.clientDocument.create({
        data: {
          organizationId: ctx.organizationId,
          fileId: input.fileId,
          entity: "client",
          entityId: clientId,
          visibility: "client",
          addedBy: ctx.userId,
        },
        select: { id: true, createdAt: true },
      })
      const client = await prisma.client.findFirst({
        where: { id: clientId, organizationId: ctx.organizationId },
        select: { name: true },
      })
      await recordUserAudit(ctx, {
        action: AUDIT_ACTIONS.clientDocumentLinked,
        entityType: "client",
        entityId: clientId,
        entityLabel: client?.name ?? input.name,
        after: { fileName: input.name },
      })
      return { id: link.id, createdAt: link.createdAt.toISOString() }
    }
    default:
      throw new NotFoundError("Domain operation")
  }
}

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import type { RequestContext } from "@/lib/core/context"
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/core/errors"
import { roleRank } from "@/lib/organization/roles"
import { prisma } from "@/lib/prisma"

import type { PortalContext } from "./context"
import type { InvitePortalUserInput } from "./schemas"
import type {
  PortalAccessData,
  PortalDashboardData,
  PortalProjectDetailData,
} from "./types"

function requirePortalManager(ctx: RequestContext) {
  if (roleRank(ctx.role) >= 3) return
  throw new ForbiddenError("Your role cannot manage portal access.", {
    code: "role_cannot_manage_members",
  })
}

function requireInternalMember(ctx: RequestContext) {
  if (roleRank(ctx.role) >= 2) return
  throw new ForbiddenError("Your role cannot view portal access.", {
    code: "role_cannot_manage_members",
  })
}

function iso(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined
}

export class PortalService {
  // ---------------------------------------------------------------------------
  // Client-facing reads
  // ---------------------------------------------------------------------------

  /** Dashboard of the signed-in client: their projects and shared documents. */
  async getDashboard(ctx: PortalContext): Promise<PortalDashboardData> {
    const [projects, links] = await Promise.all([
      prisma.project.findMany({
        where: {
          organizationId: ctx.organizationId,
          clientId: ctx.clientId,
        },
        select: {
          id: true,
          name: true,
          status: true,
          dueDate: true,
          tasks: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.crmDocument.findMany({
        where: {
          organizationId: ctx.organizationId,
          entity: "client",
          entityId: ctx.clientId,
          visibility: "client",
          file: { trashed: false },
        },
        select: {
          id: true,
          fileId: true,
          file: { select: { name: true, sizeBytes: true } },
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    return {
      organizationName: ctx.organizationName,
      clientName: ctx.clientName,
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        status: project.status,
        dueDate: iso(project.dueDate),
        doneTasks: project.tasks.filter((task) => task.status === "done")
          .length,
        totalTasks: project.tasks.length,
      })),
      documents: links.map((link) => ({
        id: link.id,
        fileId: link.fileId,
        name: link.file.name,
        sizeBytes: link.file.sizeBytes ? Number(link.file.sizeBytes) : undefined,
        createdAt: link.createdAt.toISOString(),
      })),
    }
  }

  /** One project of the client's company. Anything else is not found. */
  async getProject(
    ctx: PortalContext,
    projectId: string
  ): Promise<PortalProjectDetailData> {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: ctx.organizationId,
        clientId: ctx.clientId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        dueDate: true,
        createdAt: true,
        tasks: {
          select: { id: true, title: true, status: true, dueDate: true },
          orderBy: { order: "asc" },
        },
      },
    })

    if (!project) throw new NotFoundError("Project")

    return {
      id: project.id,
      name: project.name,
      description: project.description ?? undefined,
      status: project.status,
      dueDate: iso(project.dueDate),
      createdAt: project.createdAt.toISOString(),
      tasks: project.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: iso(task.dueDate),
      })),
    }
  }

  // ---------------------------------------------------------------------------
  // Access management (internal CRM side)
  // ---------------------------------------------------------------------------

  /** Portal users and pending invitations of a company. */
  async listAccess(
    ctx: RequestContext,
    clientId: string
  ): Promise<PortalAccessData> {
    requireInternalMember(ctx)
    const [members, invites] = await Promise.all([
      prisma.member.findMany({
        where: { organizationId: ctx.organizationId, clientId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.portalInvite.findMany({
        where: {
          organizationId: ctx.organizationId,
          clientId,
          acceptedAt: null,
        },
        orderBy: { createdAt: "desc" },
      }),
    ])

    return {
      members: members.map((member) => ({
        memberId: member.id,
        userId: member.user.id,
        name: member.user.name,
        email: member.user.email,
        createdAt: member.createdAt.toISOString(),
      })),
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        name: invite.name ?? undefined,
        createdAt: invite.createdAt.toISOString(),
        invitationId: invite.invitationId ?? undefined,
      })),
    }
  }

  /** Invite a company contact to the portal and return the invitation link. */
  async invite(
    ctx: RequestContext,
    input: InvitePortalUserInput
  ): Promise<{ invite: { id: string; email: string; invitationId?: string } }> {
    requirePortalManager(ctx)

    const client = await prisma.client.findFirst({
      where: { id: input.clientId, organizationId: ctx.organizationId },
      select: { id: true },
    })
    if (!client) throw new NotFoundError("Client")

    const email = input.email.toLowerCase()
    const existingMember = await prisma.member.findFirst({
      where: { organizationId: ctx.organizationId, user: { email } },
      select: { id: true },
    })
    if (existingMember) {
      throw new ConflictError("That email is already a member.", {
        code: "email_already_member",
      })
    }
    const existingInvite = await prisma.portalInvite.findFirst({
      where: {
        organizationId: ctx.organizationId,
        clientId: input.clientId,
        email,
        acceptedAt: null,
      },
      select: { id: true },
    })
    if (existingInvite) {
      throw new ConflictError(
        "That email already has a pending portal invitation.",
        { code: "portal_invite_exists" }
      )
    }

    const invitation = await auth.api.createInvitation({
      headers: await headers(),
      body: {
        organizationId: ctx.organizationId,
        email,
        role: "client",
      },
    })

    const row = await prisma.portalInvite.create({
      data: {
        organizationId: ctx.organizationId,
        clientId: input.clientId,
        email,
        name: input.name || null,
        invitationId: invitation.id,
        invitedById: ctx.userId,
      },
    })

    return {
      invite: { id: row.id, email: row.email, invitationId: invitation.id },
    }
  }

  /** Revoke portal access: removes the organization member entirely. */
  async revokeMember(
    ctx: RequestContext,
    memberId: string
  ): Promise<{ id: string }> {
    requirePortalManager(ctx)
    const member = await prisma.member.findFirst({
      where: {
        id: memberId,
        organizationId: ctx.organizationId,
        clientId: { not: null },
      },
      select: { id: true },
    })
    if (!member) throw new NotFoundError("Member")
    await prisma.member.delete({ where: { id: memberId } })
    return { id: memberId }
  }

  /** Cancel a pending portal invitation (revokes the better-auth invitation). */
  async cancelInvite(
    ctx: RequestContext,
    inviteId: string
  ): Promise<{ id: string }> {
    requirePortalManager(ctx)
    const invite = await prisma.portalInvite.findFirst({
      where: { id: inviteId, organizationId: ctx.organizationId },
      select: { id: true, invitationId: true },
    })
    if (!invite) throw new NotFoundError("Invitation")
    if (invite.invitationId) {
      try {
        await auth.api.cancelInvitation({
          headers: await headers(),
          body: { invitationId: invite.invitationId },
        })
      } catch {
        // The invitation may already be accepted, expired or cancelled.
      }
    }
    await prisma.portalInvite.delete({ where: { id: inviteId } })
    return { id: inviteId }
  }

  /**
   * Called right after a client accepts their invitation: links the fresh
   * member row to the invited company and returns whether it was a portal
   * invitation.
   */
  async claim(invitationId: string): Promise<{ portal: boolean }> {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) throw new UnauthorizedError()

    const invite = await prisma.portalInvite.findFirst({
      where: { invitationId, acceptedAt: null },
      select: { id: true, organizationId: true, clientId: true, email: true },
    })
    if (!invite) return { portal: false }
    if (invite.email.toLowerCase() !== session.user.email.toLowerCase()) {
      return { portal: false }
    }

    const member = await prisma.member.findFirst({
      where: {
        organizationId: invite.organizationId,
        userId: session.user.id,
      },
      select: { id: true, clientId: true },
    })
    if (member && member.clientId !== invite.clientId) {
      await prisma.member.update({
        where: { id: member.id },
        data: { clientId: invite.clientId, role: "client" },
      })
    }

    await prisma.portalInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })
    return { portal: true }
  }
}

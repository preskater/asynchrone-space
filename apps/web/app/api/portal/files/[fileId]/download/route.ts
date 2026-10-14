import { Readable } from "node:stream"

import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { openLargeObjectStream } from "@/lib/large-object"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Download of a client-visible document for portal users. Access requires a
 * member row linked to a company and a CrmDocument(visibility=client) link on
 * that company.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { fileId } = await params

  const activeOrganizationId = session.session.activeOrganizationId as
    | string
    | undefined
  const members = await prisma.member.findMany({
    where: { userId: session.user.id, clientId: { not: null } },
    select: { organizationId: true, clientId: true },
  })
  const member =
    members.find((entry) => entry.organizationId === activeOrganizationId) ??
    members[0]

  if (!member?.clientId) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const link = await prisma.crmDocument.findFirst({
    where: {
      organizationId: member.organizationId,
      entity: "client",
      entityId: member.clientId,
      visibility: "client",
      fileId,
    },
    select: {
      file: {
        select: { name: true, oid: true, mimeType: true, trashed: true },
      },
    },
  })

  if (!link || link.file.trashed || link.file.oid === null) {
    return new NextResponse("Not found", { status: 404 })
  }

  const { size, stream } = await openLargeObjectStream(Number(link.file.oid))

  const body = Readable.toWeb(stream) as unknown as ReadableStream
  return new NextResponse(body, {
    headers: {
      "Content-Type": link.file.mimeType || "application/octet-stream",
      "Content-Length": String(size),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(link.file.name)}"`,
      "Cache-Control": "private, no-cache",
    },
  })
}

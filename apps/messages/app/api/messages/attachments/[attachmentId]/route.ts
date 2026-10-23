import { Readable } from "node:stream"

import { NextResponse } from "next/server"

import { getRequestContext } from "@workspace/auth/server"
import { openLargeObjectStream } from "@workspace/storage"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const ctx = await getRequestContext({ request })
  const { attachmentId } = await params

  const attachment = await prisma.messageAttachment.findFirst({
    where: {
      id: attachmentId,
      message: { conversation: { organizationId: ctx.organizationId } },
    },
    select: { name: true, oid: true, mimeType: true },
  })

  if (!attachment || attachment.oid === null) {
    return new NextResponse("Not found", { status: 404 })
  }

  const { size, stream } = await openLargeObjectStream(Number(attachment.oid))

  const body = Readable.toWeb(stream) as unknown as ReadableStream
  return new NextResponse(body, {
    headers: {
      "Content-Type": attachment.mimeType || "application/octet-stream",
      "Content-Length": String(size),
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(attachment.name)}"`,
      "Cache-Control": "private, no-cache",
    },
  })
}

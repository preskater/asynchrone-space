import { NextResponse } from "next/server"

import { getRequestContext } from "@workspace/auth/server"
import { toAppError } from "@workspace/core"
import { jsonError } from "@workspace/core/server"
import {
  abortUploadSession,
  appendUploadChunk,
  getUploadSession,
} from "@workspace/files/upload-session"

export const runtime = "nodejs"
export const maxDuration = 60

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
): Promise<NextResponse> {
  try {
    const ctx = await getRequestContext({ request })
    const { uploadId } = await params

    const offsetHeader = request.headers.get("x-chunk-offset")
    const offset = Number(offsetHeader)
    if (offsetHeader === null || !Number.isInteger(offset) || offset < 0) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "Missing or invalid chunk offset." } },
        { status: 400 }
      )
    }
    if (!request.body) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "A request body is required." } },
        { status: 400 }
      )
    }

    const chunk = Buffer.from(await request.arrayBuffer())
    const result = await appendUploadChunk(ctx, uploadId, offset, chunk)
    return NextResponse.json(result)
  } catch (error) {
    return jsonError(toAppError(error))
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
): Promise<NextResponse> {
  try {
    const ctx = await getRequestContext({ request })
    const { uploadId } = await params
    const session = await getUploadSession(ctx, uploadId)
    return NextResponse.json(session)
  } catch (error) {
    return jsonError(toAppError(error))
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
): Promise<NextResponse> {
  try {
    const ctx = await getRequestContext({ request })
    const { uploadId } = await params
    await abortUploadSession(ctx, uploadId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return jsonError(toAppError(error))
  }
}

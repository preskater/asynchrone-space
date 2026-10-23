import { NextResponse } from "next/server"

import { getRequestContext } from "@workspace/auth/server"
import { toAppError } from "@workspace/core"
import { jsonError } from "@workspace/core/server"
import { completeUploadSession } from "@workspace/files/upload-session"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uploadId: string }> }
): Promise<NextResponse> {
  try {
    const ctx = await getRequestContext({ request })
    const { uploadId } = await params
    const result = await completeUploadSession(ctx, uploadId)

    // Workspace files return the created FileNode; transient message
    // attachments return the large-object reference for the caller to persist.
    if (result.file) return NextResponse.json(result.file)
    return NextResponse.json({
      oid: result.oid,
      size: result.size,
      sha256: result.sha256,
    })
  } catch (error) {
    return jsonError(toAppError(error))
  }
}

export function GET(): NextResponse {
  return new NextResponse("Method Not Allowed", { status: 405 })
}

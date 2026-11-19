import { NextResponse } from "next/server"

import { buildOpenApiDocument } from "@/lib/public-api/openapi"

export const runtime = "nodejs"

/** Same document as the landing download; it holds no data, so no token. */
export function GET() {
  return NextResponse.json(buildOpenApiDocument(), {
    headers: { "Cache-Control": "public, max-age=300" },
  })
}

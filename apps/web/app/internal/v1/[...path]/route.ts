import { internalAudience, SERVICE_SCOPES } from "@workspace/contracts"
import {
  ServiceTokenVerifier,
  requireInternalService,
} from "@workspace/service-auth"

import { handleIdentityRequest } from "@/lib/identity/handler"
import { identityRepository } from "@/lib/identity/repository"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function verifier(): ServiceTokenVerifier {
  const issuer = process.env.COPILOT_APP_URL ?? process.env.BETTER_AUTH_URL
  if (!issuer) {
    throw new Error("COPILOT_APP_URL or BETTER_AUTH_URL is required")
  }
  return new ServiceTokenVerifier({
    issuer,
    audience: internalAudience("copilot"),
  })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
): Promise<Response> {
  const { path } = await context.params
  let serviceVerifier: ServiceTokenVerifier
  try {
    serviceVerifier = verifier()
  } catch (cause) {
    console.error("[identity] verifier configuration failed", cause)
    return Response.json(
      {
        error: {
          code: "misconfigured",
          message: "Identity API is not configured",
        },
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }

  return handleIdentityRequest({
    segments: path,
    request,
    repository: identityRepository,
    authorize: () =>
      requireInternalService(request, serviceVerifier, {
        requiredScopes: [SERVICE_SCOPES.identityRead],
      }),
  })
}

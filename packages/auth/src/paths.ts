import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { auth } from "./auth"
import { prisma } from "@workspace/db"

export async function getActiveOrgSlug(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const organizations = await auth.api.listOrganizations({
    headers: await headers(),
  })

  if (organizations.length === 0) return null

  const sessionOrganizationId = session.session.activeOrganizationId ?? null
  const active =
    organizations.find((org) => org.id === sessionOrganizationId) ??
    organizations[0]

  return active?.slug ?? null
}

export function organizationPath(slug: string, path = "") {
  return `/${slug}${path}`
}

export async function revalidateOrgPath(organizationId: string, path = "") {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  })

  if (!organization) return

  revalidatePath(organizationPath(organization.slug, path))
}

"use client"

import * as React from "react"

import { setActiveOrganizationAction } from "@workspace/auth/actions"

/**
 * Keeps `Session.activeOrganizationId` aligned with the organization named in
 * the URL when a user opens a domain app directly.
 */
export function OrganizationSync({
  organizationId,
}: {
  organizationId: string
}) {
  React.useEffect(() => {
    void setActiveOrganizationAction(organizationId)
  }, [organizationId])

  return null
}

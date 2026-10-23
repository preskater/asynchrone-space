"use client"

import * as React from "react"

import { OrganizationSync } from "./organization-sync"

interface WorkspaceContextValue {
  userId: string
  role: string | null
  orgSlug: string
  organizationId: string
  organizationName: string
  authBaseUrl: string
  locale: string
}

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({
  value,
  activeOrganizationId,
  organizationId,
  children,
}: {
  value: WorkspaceContextValue
  activeOrganizationId?: string | null
  organizationId?: string
  children: React.ReactNode
}) {
  return (
    <WorkspaceContext.Provider value={value}>
      {organizationId && activeOrganizationId !== organizationId ? (
        <OrganizationSync organizationId={organizationId} />
      ) : null}
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider")
  }
  return context
}

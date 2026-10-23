"use client"

import { orgPermissions } from "@workspace/organization"

import { useWorkspace } from "./workspace-context"

/** Permission-gated UI derived from the role resolved by the app layout. */
export function useOrgPermissions() {
  const { role } = useWorkspace()
  return orgPermissions(role)
}

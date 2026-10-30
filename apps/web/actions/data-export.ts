"use server"

import { withAction } from "@/lib/core/action"
import { getRequestContext } from "@/lib/core/auth-context"
import { requestExport } from "@/lib/organization/export-service"

export const requestExportAction = withAction(async () => {
  const ctx = await getRequestContext()
  return requestExport(ctx)
})

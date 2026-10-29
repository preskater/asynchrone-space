"use server"

import { withAction } from "@/lib/core/action"
import { getRequestContext } from "@/lib/core/auth-context"
import { startTeamTrial } from "@/lib/organization/trial-service"

export const startTeamTrialAction = withAction(async () => {
  const ctx = await getRequestContext()
  return startTeamTrial(ctx)
})

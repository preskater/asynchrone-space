"use server"

import { withAction } from "@/lib/core/action"
import { getRequestContext } from "@/lib/core/auth-context"
import { setTwoFactorRequired } from "@/lib/organization/two-factor-policy"

export const setTwoFactorRequiredAction = withAction(
  async (required: boolean) => {
    const ctx = await getRequestContext()
    await setTwoFactorRequired(ctx, required === true)
  }
)

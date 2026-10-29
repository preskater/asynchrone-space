import { NextResponse } from "next/server"

import { billingService } from "@/lib/billing"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Sends the "your trial ends soon" reminder once per trial. Meant to run daily
 * from the scheduled CronJob (guarded with `CRON_SECRET` when configured).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const authorization = request.headers.get("authorization")
    if (authorization !== `Bearer ${secret}`) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
  }

  const sent = await billingService.sendTrialReminders()
  return NextResponse.json({ ok: true, sent })
}

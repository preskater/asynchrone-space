import { NextResponse } from "next/server"

import { createCronRoute } from "@workspace/observability/next"

import {
  dispatchPendingDeliveries,
  pruneWebhookDeliveries,
} from "@/lib/webhooks/dispatcher"

export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Delivers due webhook events and prunes old delivery rows. Called by the
 * scheduled Kubernetes CronJob and guarded with `CRON_SECRET` when configured.
 * Idempotent: every delivery is claimed with a lease before it is sent.
 */
export const GET = createCronRoute(
  { app: "copilot", job: "webhook-deliveries" },
  async (request): Promise<NextResponse> => {
    const secret = process.env.CRON_SECRET
    if (secret) {
      const authorization = request.headers.get("authorization")
      if (authorization !== `Bearer ${secret}`) {
        return new NextResponse("Unauthorized", { status: 401 })
      }
    }

    const result = await dispatchPendingDeliveries()
    const pruned = await pruneWebhookDeliveries()
    return NextResponse.json({ ok: true, ...result, pruned })
  }
)

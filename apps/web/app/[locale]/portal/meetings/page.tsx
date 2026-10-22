import { redirect } from "next/navigation"

import { PortalMeetings } from "@/components/portal/portal-meetings"
import { meetingService } from "@/lib/meetings"
import { getPortalContext } from "@/lib/portal/context"

export default async function PortalMeetingsPage() {
  const ctx = await getPortalContext()
  if (!ctx) redirect("/onboarding")

  const data = await meetingService.getPortalMeetings(ctx)
  return <PortalMeetings data={data} />
}

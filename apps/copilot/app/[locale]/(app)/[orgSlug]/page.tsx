import { listConversations } from "@workspace/ai/server"

import { CopilotScreen } from "@/components/copilot-screen"
import { resolveWorkspace } from "@/lib/workspace"

export default async function NewCopilotPage({
  params,
}: {
  params: Promise<{ locale: string; orgSlug: string }>
}) {
  const { locale, orgSlug } = await params
  const { ctx } = await resolveWorkspace(orgSlug, locale)
  const conversations = await listConversations(ctx)

  return (
    <CopilotScreen
      conversations={conversations}
      orgSlug={orgSlug}
      locale={locale}
    />
  )
}

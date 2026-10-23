import { notFound } from "next/navigation"

import { getConversation, listConversations } from "@workspace/ai/server"

import { CopilotScreen } from "@/components/copilot-screen"
import { resolveWorkspace } from "@/lib/workspace"

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ locale: string; orgSlug: string; conversationId: string }>
}) {
  const { locale, orgSlug, conversationId } = await params
  const { ctx } = await resolveWorkspace(orgSlug, locale)

  const [found, conversations] = await Promise.all([
    getConversation(ctx, conversationId),
    listConversations(ctx),
  ])

  if (!found) notFound()

  return (
    <CopilotScreen
      conversations={conversations}
      activeId={conversationId}
      initialMessages={found.messages}
      orgSlug={orgSlug}
      locale={locale}
    />
  )
}

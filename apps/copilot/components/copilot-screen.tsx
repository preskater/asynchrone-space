"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { PlusIcon } from "lucide-react"

import { AssistantProvider, type ChatMessage, type ConversationSummary } from "@workspace/ai/client"
import { Link, useRouter } from "@workspace/i18n/navigation"
import { Button } from "@workspace/ui/components/button"

import { AssistantWorkspace } from "./assistant/assistant-workspace"

export function CopilotScreen({
  conversations,
  activeId,
  initialMessages,
  orgSlug,
  locale,
}: {
  conversations: ConversationSummary[]
  activeId?: string
  initialMessages?: ChatMessage[]
  orgSlug: string
  locale: string
}) {
  const t = useTranslations("Assistant")
  const router = useRouter()

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 flex-col border-e bg-sidebar/40 md:flex">
        <div className="p-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            nativeButton={false}
            render={<Link href={`/${orgSlug}`} prefetch={false} />}
          >
            <PlusIcon className="size-4" />
            {t("newChat")}
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          <ul className="flex flex-col gap-1">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/${orgSlug}/c/${conversation.id}`}
                  prefetch={false}
                  className={`block truncate rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                    conversation.id === activeId
                      ? "bg-muted font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {conversation.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AssistantProvider
          key={activeId ?? "new"}
          initialMessages={initialMessages}
          initialConversationId={activeId}
          onConversationCreated={(id) => {
            window.history.replaceState(null, "", `/${locale}/${orgSlug}/c/${id}`)
          }}
          onComplete={() => {
            // Refresh the server-rendered conversation list without remounting
            // the provider or interrupting the finished stream.
            router.refresh()
          }}
        >
          <AssistantWorkspace />
        </AssistantProvider>
      </div>
    </div>
  )
}

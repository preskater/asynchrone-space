"use client"

import * as React from "react"

import { useMessaging } from "@workspace/messaging/store"

interface MessagesNavStore {
  messagesActiveId: string | undefined
  selectConversation: (id: string) => void
  messagesSearchOpen: boolean
  setMessagesSearchOpen: (open: boolean) => void
}

const MessagesNavContext = React.createContext<MessagesNavStore | null>(null)

export function MessagesNavProvider({ children }: { children: React.ReactNode }) {
  const { conversations } = useMessaging()
  const [messagesActiveId, setMessagesActiveId] = React.useState<
    string | undefined
  >(() => conversations[0]?.id)
  const [messagesSearchOpen, setMessagesSearchOpen] = React.useState(false)

  const store = React.useMemo<MessagesNavStore>(
    () => ({
      messagesActiveId,
      selectConversation: setMessagesActiveId,
      messagesSearchOpen,
      setMessagesSearchOpen,
    }),
    [messagesActiveId, messagesSearchOpen]
  )

  return (
    <MessagesNavContext.Provider value={store}>
      {children}
    </MessagesNavContext.Provider>
  )
}

export function useMessagesNav() {
  const context = React.useContext(MessagesNavContext)
  if (!context) {
    throw new Error("useMessagesNav must be used within a MessagesNavProvider")
  }
  return context
}

export const useWorkspaceNav = useMessagesNav

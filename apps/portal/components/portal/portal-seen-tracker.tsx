"use client"

import * as React from "react"

import { markPortalSeenAction } from "@workspace/portal/actions"

/**
 * Marks the portal visit as seen once the page has painted, so unread badges
 * stay visible for the whole visit and clear on the next one.
 */
export function PortalSeenTracker() {
  React.useEffect(() => {
    void markPortalSeenAction()
  }, [])
  return null
}

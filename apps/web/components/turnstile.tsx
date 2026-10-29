"use client"

import { useEffect, useRef } from "react"
import Script from "next/script"

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      "expired-callback": () => void
      "error-callback": () => void
    }
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

/**
 * Cloudflare Turnstile widget. Tokens are single-use: remount it (change its
 * `key`) after each submission so the next attempt gets a fresh token. Pass a
 * stable `onToken` (e.g. a state setter).
 */
export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken: (token: string | null) => void
}) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let widgetId: string | undefined
    const mount = () => {
      if (!window.turnstile || !container.current) return
      window.clearInterval(timer)
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      })
    }
    // The script may still be loading on first render.
    const timer = window.setInterval(mount, 200)
    mount()
    return () => {
      window.clearInterval(timer)
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [siteKey, onToken])

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={container} />
    </>
  )
}

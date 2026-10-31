import { after } from "next/server"
import { Resend } from "resend"

/**
 * Transactional email transport via Resend.
 *
 * Configuration is optional so local development and previews keep working
 * without a provider: without `RESEND_API_KEY` / `EMAIL_FROM` every send is
 * skipped (with one warning) instead of failing the request.
 *
 * Templates and product copy stay in the app; this module only owns delivery.
 */
let warnedDisabled = false

function warnDisabled() {
  if (warnedDisabled) return
  warnedDisabled = true
  console.warn(
    "[email] RESEND_API_KEY or EMAIL_FROM is not set — transactional emails are disabled"
  )
}

export interface EmailAttachment {
  filename: string
  /** Base64 content, without the `data:` URL prefix. */
  content: string
  contentType?: string
}

export interface Email {
  to: string | string[]
  subject: string
  html: string
  /** Makes "Reply" in the inbox answer the person who triggered the email. */
  replyTo?: string
  attachments?: EmailAttachment[]
}

/** `disabled` means no provider is configured, not that delivery failed. */
export type EmailDelivery = "sent" | "disabled" | "failed"

/**
 * Sends an email and waits for the provider's answer. Use this when the caller
 * needs to report the outcome (e.g. the feedback form); otherwise prefer
 * {@link sendEmail}, which defers delivery.
 */
export async function deliverEmail({
  to,
  subject,
  html,
  replyTo,
  attachments,
}: Email): Promise<EmailDelivery> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) {
    warnDisabled()
    return "disabled"
  }

  try {
    // Resend reports API failures in the resolved value, not by rejecting.
    const { data, error } = await new Resend(apiKey).emails.send({
      from,
      to,
      subject,
      html,
      replyTo,
      attachments,
    })
    if (error) {
      console.error(`[email] "${subject}" failed:`, error.message)
      return "failed"
    }
    console.info(`[email] "${subject}" sent:`, data?.id)
    return "sent"
  } catch (error) {
    console.error(`[email] "${subject}" failed:`, error)
    return "failed"
  }
}

/**
 * Delivery is deferred so a password-reset request takes the same time for an
 * existing account and an unknown one, which would otherwise leak account
 * existence. `after()` keeps a serverless invocation alive until Resend has
 * answered, so the message is not dropped when the response returns first.
 * Outside a request scope (scripts, unit tests) it simply runs unawaited.
 */
export function sendEmail(email: Email) {
  const send = () => {
    void deliverEmail(email)
  }

  try {
    after(send)
  } catch {
    send()
  }
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

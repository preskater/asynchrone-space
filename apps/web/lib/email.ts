import { after } from "next/server"
import { Resend } from "resend"

/**
 * Transactional email via Resend.
 *
 * Configuration is optional so local development and previews keep working
 * without a provider: without `RESEND_API_KEY` / `EMAIL_FROM` every send is
 * skipped (with one warning) instead of failing the request.
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
 * Prefer the public app URL for links inside emails; the URL Better Auth
 * generates is rooted at BETTER_AUTH_URL, which may be an internal address.
 */
function publicUrl(url: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL
  if (!base) return url
  const parsed = new URL(url)
  return `${base.replace(/\/+$/, "")}${parsed.pathname}${parsed.search}`
}

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

function layout({
  heading,
  body,
  cta,
  url,
}: {
  heading: string
  body: string
  cta: string
  url: string
}) {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:8px;padding:32px">
            <tr>
              <td>
                <h1 style="margin:0 0 16px;font-size:20px;line-height:28px">${heading}</h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:22px;color:#52525b">${body}</p>
                <a href="${url}" style="display:inline-block;background-color:#18181b;color:#ffffff;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none">${cta}</a>
                <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#71717a">If the button doesn't work, copy this link into your browser:</p>
                <p style="margin:4px 0 0;font-size:12px;line-height:18px;color:#71717a;word-break:break-all">${url}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export function sendVerificationEmail({
  to,
  url,
}: {
  to: string
  url: string
}) {
  const link = publicUrl(url)
  sendEmail({
    to,
    subject: "Verify your email address",
    html: layout({
      heading: "Verify your email address",
      body: "Confirm your email address to finish setting up your account. This link expires in one hour.",
      cta: "Verify email",
      url: link,
    }),
  })
}

export function sendResetPasswordEmail({
  to,
  url,
}: {
  to: string
  url: string
}) {
  const link = publicUrl(url)
  sendEmail({
    to,
    subject: "Reset your password",
    html: layout({
      heading: "Reset your password",
      body: "We received a request to reset the password for your account. This link expires in one hour. If you didn't ask for this, you can ignore this email.",
      cta: "Reset password",
      url: link,
    }),
  })
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

export function sendTrialReminderEmail({
  to,
  organizationName,
  daysLeft,
  url,
}: {
  to: string
  organizationName: string
  daysLeft: number
  url: string
}) {
  const days = daysLeft === 1 ? "1 day" : `${daysLeft} days`
  sendEmail({
    to,
    subject: `Your Team trial ends in ${days}`,
    html: layout({
      heading: `Your Team trial ends in ${days}`,
      body: `The Team trial of ${escapeHtml(organizationName)} ends soon. Pick a plan to keep Team features, or do nothing to drop back to Starter — your data stays intact either way.`,
      cta: "Choose a plan",
      url: publicUrl(url),
    }),
  })
}

export function sendTrialEndedEmail({
  to,
  organizationName,
  url,
}: {
  to: string
  organizationName: string
  url: string
}) {
  sendEmail({
    to,
    subject: "Your Team trial has ended",
    html: layout({
      heading: "Your Team trial has ended",
      body: `${escapeHtml(organizationName)} is back on Starter. All your projects, files and messages are intact. Pick a plan any time to get Team features back.`,
      cta: "Choose a plan",
      url: publicUrl(url),
    }),
  })
}

export function sendPaymentFailedEmail({
  to,
  organizationName,
  amountDue,
  currency,
  url,
}: {
  to: string
  organizationName: string
  amountDue: number
  currency: string
  url: string
}) {
  const link = publicUrl(url)
  sendEmail({
    to,
    subject: `Payment failed for ${escapeHtml(organizationName)}`,
    html: layout({
      heading: "We couldn't collect your payment",
      body: `The ${formatAmount(amountDue, currency)} payment for ${escapeHtml(organizationName)} did not go through. Update your payment method to keep the Team plan — we retry automatically for a few days.`,
      cta: "Update payment method",
      url: link,
    }),
  })
}

export function sendOrganizationDeletedEmail({
  to,
  organizationName,
}: {
  to: string
  organizationName: string
}) {
  sendEmail({
    to,
    subject: "Your organization has been deleted",
    html: layout({
      heading: "Your organization has been deleted",
      body: `${escapeHtml(organizationName)} and all of its data, including files, have been permanently deleted as you requested.`,
      cta: "Open Asynchrone Space",
      url: publicUrl(new URL("/", process.env.BETTER_AUTH_URL).toString()),
    }),
  })
}

export function sendDataExportReadyEmail({
  to,
  organizationName,
  url,
  days,
}: {
  to: string
  organizationName: string
  url: string
  days: number
}) {
  sendEmail({
    to,
    subject: "Your data export is ready",
    html: layout({
      heading: "Your data export is ready",
      body: `The export of ${escapeHtml(organizationName)} is ready to download from the organization settings. The link expires in ${days} days.`,
      cta: "Open settings",
      url: publicUrl(url),
    }),
  })
}

export function sendAccountDeletedEmail({ to }: { to: string }) {
  sendEmail({
    to,
    subject: "Your account has been deleted",
    html: layout({
      heading: "Your account has been deleted",
      body: "Your Asynchrone Space account has been deleted as you requested. You have been removed from every organization and can no longer sign in. Content you created in an organization stays there, shown as written by a deleted user.",
      cta: "Open Asynchrone Space",
      url: publicUrl(new URL("/", process.env.BETTER_AUTH_URL).toString()),
    }),
  })
}

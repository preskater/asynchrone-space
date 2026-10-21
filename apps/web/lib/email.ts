import { Resend } from "resend"

/**
 * Transactional email via Resend.
 *
 * Configuration is optional so local development and previews keep working
 * without a provider: without `RESEND_API_KEY` / `EMAIL_FROM` every send is
 * skipped (with one warning at startup) instead of failing the request.
 */
if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
  console.warn(
    "[email] RESEND_API_KEY or EMAIL_FROM is not set — transactional emails are disabled"
  )
}

interface Email {
  to: string
  subject: string
  html: string
}

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
 * Fire-and-forget: waiting on Resend would make a password-reset request
 * measurably slower for existing accounts than for unknown ones, which leaks
 * account existence. Better Auth itself simulates the same work server-side.
 *
 * ponytail: a serverless invocation may freeze before the send completes; use
 * `after()` from next/server if delivery proves unreliable on Vercel.
 */
export function sendEmail({ to, subject, html }: Email) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return
  void new Resend(apiKey).emails
    .send({ from, to, subject, html })
    // Resend reports API failures in the resolved value, not by rejecting.
    .then(({ data, error }) => {
      if (error) console.error(`[email] "${subject}" failed:`, error.message)
      else console.info(`[email] "${subject}" sent:`, data?.id)
    })
    .catch((error) => console.error(`[email] "${subject}" failed:`, error))
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

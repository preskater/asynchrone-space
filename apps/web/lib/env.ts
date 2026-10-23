/**
 * Runtime configuration validation.
 *
 * Imported for its side effect by `lib/prisma.ts` (which every server entry
 * point loads) so a misconfigured deployment fails loudly at boot with a clear
 * message instead of crashing per request. Keep this dependency-free so it can
 * also run under `tsx` (e.g. `scripts/verify-large-object.ts`).
 */
interface Rule {
  key: string
  required?: boolean
  url?: boolean
  min?: number
}

const RULES: Rule[] = [
  { key: "DATABASE_URL", required: true },
  { key: "BETTER_AUTH_SECRET", required: true, min: 16 },
  { key: "BETTER_AUTH_URL", required: true, url: true },
  { key: "AUTH_COOKIE_DOMAIN" },
  { key: "PROJECTS_APP_URL", url: true },
  { key: "CALENDARS_APP_URL", url: true },
  { key: "FILES_APP_URL", url: true },
  { key: "MESSAGES_APP_URL", url: true },
  { key: "CRM_APP_URL", url: true },
  { key: "HR_APP_URL", url: true },
  { key: "PORTAL_APP_URL", url: true },
  { key: "COPILOT_APP_URL", url: true },
  { key: "OPENAI_API_URL", url: true },
  { key: "MCP_RESOURCE_URL", url: true },
  { key: "NEXT_PUBLIC_APP_URL", url: true },
]

const problems: string[] = []

for (const rule of RULES) {
  const value = process.env[rule.key]
  if (rule.required && (value === undefined || value === "")) {
    problems.push(`${rule.key} is required`)
    continue
  }
  if (value === undefined || value === "") continue
  if (rule.min && value.length < rule.min) {
    problems.push(`${rule.key} must be at least ${rule.min} characters`)
  }
  if (rule.url) {
    try {
      new URL(value)
    } catch {
      problems.push(`${rule.key} must be a valid URL`)
    }
  }
}

if (process.env.REQUIRE_EMAIL_VERIFICATION === "true") {
  for (const key of ["RESEND_API_KEY", "EMAIL_FROM"]) {
    if (!process.env[key]) {
      problems.push(
        `${key} is required when REQUIRE_EMAIL_VERIFICATION is enabled`
      )
    }
  }
}

if (problems.length > 0) {
  throw new Error(
    `Invalid environment configuration:\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}`
  )
}

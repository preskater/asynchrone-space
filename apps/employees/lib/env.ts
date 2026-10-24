/**
 * Runtime configuration validation for the projects app. Imported by the
 * auth/prisma shims so a misconfigured deployment fails at boot.
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
  { key: "CLIENTS_APP_URL", url: true },
  { key: "EMPLOYEES_APP_URL", url: true },
  { key: "PORTAL_APP_URL", url: true },
  { key: "COPILOT_APP_URL", url: true },
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

if (problems.length > 0) {
  throw new Error(
    `Invalid environment configuration:\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}`
  )
}

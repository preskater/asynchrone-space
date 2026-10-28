/**
 * Runtime configuration for the control tower.
 *
 * Validated on first import (fail fast). Only this app's own keys live here;
 * database keys are validated by `@workspace/db`.
 */
interface Rule {
  key: string
  min?: number
  url?: boolean
}

const RULES: Rule[] = [
  { key: "DATABASE_URL" },
  { key: "BETTER_AUTH_URL", url: true },
  { key: "CONTROL_TOWER_BETTER_AUTH_SECRET", min: 32 },
  { key: "PLATFORM_APP_URL", url: true },
]

const problems: string[] = []

for (const rule of RULES) {
  const value = process.env[rule.key]
  if (value === undefined || value === "") {
    problems.push(`${rule.key} is required`)
    continue
  }
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
    `Invalid control-tower configuration:\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}`
  )
}

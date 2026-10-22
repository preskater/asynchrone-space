/**
 * Database-only runtime configuration validation.
 *
 * Imported for its side effect by `src/prisma.ts`, so any consumer of
 * `@workspace/db` fails loudly on a missing connection string. App-specific
 * requirements (auth URLs, email providers, ...) stay in each app's own env
 * module so this package can be reused by the control tower without inheriting
 * the customer app's boot rules.
 */
const problems: string[] = []

if (!process.env.DATABASE_URL) {
  problems.push("DATABASE_URL is required")
}

const poolMax = process.env.DATABASE_POOL_MAX
if (poolMax !== undefined && poolMax !== "") {
  const value = Number(poolMax)
  if (!Number.isFinite(value) || value <= 0) {
    problems.push("DATABASE_POOL_MAX must be a positive number")
  }
}

if (problems.length > 0) {
  throw new Error(
    `Invalid database configuration:\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}`
  )
}

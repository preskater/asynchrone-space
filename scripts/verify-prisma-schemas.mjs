#!/usr/bin/env node
/**
 * Validate every per-app Prisma schema without connecting to a database.
 * `prisma generate` in the typecheck/build graph also validates, but this
 * command gives CI a fast, explicit schema check.
 */

import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"
import { join } from "node:path"

const packages = readdirSync("packages", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("db-"))
  .map((entry) => `packages/${entry.name}/prisma/schema.prisma`)
  .filter((schema) => {
    try {
      readdirSync(join(schema, ".."))
      return true
    } catch {
      return false
    }
  })

if (packages.length === 0) {
  console.error("No per-app Prisma schemas found")
  process.exit(1)
}

for (const schema of packages) {
  execFileSync("npx", ["prisma", "validate", "--schema", schema], {
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    },
  })
  console.log(`valid ${schema}`)
}

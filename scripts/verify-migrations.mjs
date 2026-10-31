#!/usr/bin/env node
/**
 * Verify that each per-app migration directory reproduces its Prisma schema.
 * Requires the per-app databases and shadow databases (scripts/create-databases.mjs).
 */

import { execFileSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { DATABASES } from "../packages/migrate/src/databases.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const selected = DATABASES.filter((entry) => {
  const url = process.env[entry.env] ?? process.env.DATABASE_URL
  return Boolean(url)
})

if (selected.length === 0) {
  console.error("No per-app database URL is configured")
  process.exit(1)
}

for (const entry of selected) {
  const url = process.env[entry.env] ?? process.env.DATABASE_URL
  const shadow =
    process.env[entry.shadowEnv] ??
    (() => {
      const parsed = new URL(url)
      parsed.pathname = parsed.pathname + "_shadow"
      return parsed.toString()
    })()

  const dir = join(root, "packages", entry.dir, "prisma", "migrations")
  const schema = join(root, "packages", entry.dir, "prisma", "schema.prisma")
  const config = join(root, "packages", entry.dir, "prisma.config.ts")

  try {
    execFileSync(
      "npx",
      [
        "--no-install",
        "prisma",
        "migrate",
        "diff",
        "--from-migrations",
        dir,
        "--to-schema",
        schema,
        "--config",
        config,
        "--exit-code",
      ],
      {
        cwd: root,
        stdio: ["ignore", "ignore", "inherit"],
        env: {
          ...process.env,
          [entry.env]: url,
          DATABASE_URL: url,
          [entry.shadowEnv]: shadow,
        },
      }
    )
    console.log(`valid ${entry.key}`)
  } catch (error) {
    if (error.status === 2) {
      console.error(
        `drift detected in ${entry.key}: migrations do not match schema`
      )
    } else {
      console.error(`migration check failed for ${entry.key}`)
    }
    process.exit(error.status ?? 1)
  }
}

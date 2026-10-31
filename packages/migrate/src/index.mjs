#!/usr/bin/env node
/**
 * Apply (or inspect) every per-app Prisma migration in dependency order.
 *
 *   node packages/migrate/src/index.mjs
 *   node packages/migrate/src/index.mjs --status
 *   node packages/migrate/src/index.mjs --only=projects,files
 *   node packages/migrate/src/index.mjs --allow-database-url-fallback
 *
 * Production must provide each *_DATABASE_URL. The fallback is only for local
 * development and CI, where every target can point at the same server with
 * different database names.
 */

import { execFileSync } from "node:child_process"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { DATABASES } from "./databases.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

function parseArgs(argv) {
  const args = {
    status: false,
    dryRun: false,
    allowFallback: false,
    only: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i]
    if (value === "--status") args.status = true
    else if (value === "--dry-run") args.dryRun = true
    else if (value === "--allow-database-url-fallback")
      args.allowFallback = true
    else if (value === "--only") {
      args.only = new Set((argv[++i] ?? "").split(",").filter(Boolean))
    } else if (value.startsWith("--only=")) {
      args.only = new Set(
        value.slice("--only=".length).split(",").filter(Boolean)
      )
    }
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const selected = DATABASES.filter(
  (entry) => !args.only || args.only.has(entry.key)
)

if (selected.length === 0) {
  console.error("No database selected")
  process.exit(1)
}

const command = args.status ? "status" : "deploy"

for (const entry of selected) {
  const url =
    process.env[entry.env] ??
    (args.allowFallback ? process.env.DATABASE_URL : undefined)
  if (!url) {
    console.error(
      `${entry.env} is required for ${entry.key}. ` +
        "Set it, or pass --allow-database-url-fallback in local development."
    )
    process.exit(1)
  }

  const schema = join(root, "packages", entry.dir, "prisma", "schema.prisma")
  const config = join(root, "packages", entry.dir, "prisma.config.ts")
  const commandArgs = [
    "--no-install",
    "prisma",
    "migrate",
    command,
    "--schema",
    schema,
    "--config",
    config,
  ]
  console.log(
    `\n[${entry.key}] ${command} ${url.replace(/:[^:@/]+@/, ":***@")}`
  )

  if (args.dryRun) {
    console.log(`would run: npx ${commandArgs.join(" ")}`)
    continue
  }

  try {
    execFileSync("npx", commandArgs, {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        [entry.env]: url,
        DATABASE_URL: url,
        [entry.shadowEnv]:
          process.env[entry.shadowEnv] ??
          (() => {
            const parsed = new URL(url)
            parsed.pathname = parsed.pathname + "_shadow"
            return parsed.toString()
          })(),
      },
    })
  } catch (error) {
    console.error(
      `\nMigration ${command} failed for ${entry.key} (${entry.env})`
    )
    process.exit(error.status ?? 1)
  }
}

console.log(`\nDone: ${selected.length} database(s).`)

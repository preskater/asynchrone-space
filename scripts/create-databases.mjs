#!/usr/bin/env node
/**
 * Create the per-app databases and their shadow databases when missing.
 *
 * CI and local development both use this after the Postgres service is up.
 * `DATABASE_URL` must point at an existing maintenance database (the monolith
 * database is fine); the names are fixed by packages/migrate/src/databases.mjs.
 */

import pg from "pg"

import { DATABASES } from "../packages/migrate/src/databases.mjs"

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error("DATABASE_URL is required")

const client = new pg.Client({ connectionString })
await client.connect()

const names = DATABASES.flatMap((entry) => [entry.database, entry.shadow])

for (const name of names) {
  const existing = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [name]
  )
  if (existing.rowCount) {
    console.log(`= ${name}`)
    continue
  }
  // Names come from the fixed map above, never from user input.
  await client.query(`CREATE DATABASE "${name}"`)
  console.log(`+ ${name}`)
}

await client.end()

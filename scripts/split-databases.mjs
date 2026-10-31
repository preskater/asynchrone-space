#!/usr/bin/env node
/**
 * Copy the monolith database into the per-app databases during the
 * maintenance window (#185).
 *
 *   node scripts/split-databases.mjs --dry-run
 *   node scripts/split-databases.mjs --copy --verify
 *   node scripts/split-databases.mjs --all --truncate
 *
 * The script copies table data with COPY streams, preserves large-object OIDs
 * (FileNode, UploadSession, FileVersion, MessageAttachment, DataExport), and
 * verifies row counts, OID references and SHA-256 hashes. It refuses to write
 * into non-empty targets unless --truncate is explicit.
 *
 * The control-tower database is skipped by default; #191 owns its auth/audit
 * data migration. Pass --include-control-tower only after #191 is ready.
 */

import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { pipeline } from "node:stream/promises"
import { Transform } from "node:stream"
import { fileURLToPath } from "node:url"

import pg from "pg"
import { from as copyFrom, to as copyTo } from "pg-copy-streams"
import { LargeObjectManager } from "pg-large-object"

import { DATABASES } from "../packages/migrate/src/databases.mjs"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const BUFFER_SIZE = 1024 * 1024
const SHARED_AUDIT = "auditLog"

const OID_SOURCES = {
  identity: [{ table: "dataExport", column: "oid" }],
  files: [
    { table: "fileNode", column: "oid" },
    { table: "uploadSession", column: "oid" },
    { table: "fileVersion", column: "oid" },
  ],
  messages: [{ table: "messageAttachment", column: "oid" }],
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    copy: false,
    verify: false,
    all: false,
    truncate: false,
    snapshot: false,
    includeControlTower: false,
    only: null,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i]
    if (value === "--dry-run") args.dryRun = true
    else if (value === "--copy") args.copy = true
    else if (value === "--verify") args.verify = true
    else if (value === "--all") args.all = true
    else if (value === "--truncate") args.truncate = true
    else if (value === "--snapshot") args.snapshot = true
    else if (value === "--include-control-tower")
      args.includeControlTower = true
    else if (value === "--only") {
      args.only = new Set((argv[++i] ?? "").split(",").filter(Boolean))
    } else if (value.startsWith("--only=")) {
      args.only = new Set(
        value.slice("--only=".length).split(",").filter(Boolean)
      )
    }
  }
  if (
    !args.copy &&
    !args.verify &&
    !args.dryRun &&
    !args.all &&
    !args.snapshot
  ) {
    args.dryRun = true
  }
  return args
}

function schemaTables(dir) {
  const schema = readFileSync(
    join(root, "packages", dir, "prisma", "schema.prisma"),
    "utf8"
  )
  const tables = []
  for (const match of schema.matchAll(/^model\s+(\w+)\s*\{[\s\S]*?^\}/gm)) {
    const block = match[0]
    const map = block.match(/@@map\("([^"]+)"\)/)
    if (map?.[1]) tables.push(map[1])
  }
  return tables
}

function selectedDatabases(args) {
  return DATABASES.filter((entry) => {
    if (entry.key === "control-tower" && !args.includeControlTower) return false
    if (args.only && !args.only.has(entry.key)) return false
    return true
  })
}

function targetTables(entry) {
  const tables = schemaTables(entry.dir)
  // Historical audit rows stay in identity; domain audit tables start empty.
  if (entry.key !== "identity") {
    return tables.filter((table) => table !== SHARED_AUDIT)
  }
  return tables
}

function targetUrl(entry) {
  const url = process.env[entry.env] ?? process.env.DATABASE_URL
  if (!url) throw new Error(`${entry.env} or DATABASE_URL is required`)
  return url
}

function sourceUrl() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
  return process.env.DATABASE_URL
}

function quote(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`
}

async function columns(client, table) {
  const result = await client.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND is_generated = 'NEVER'
      ORDER BY ordinal_position`,
    [table]
  )
  return result.rows.map((row) => row.column_name)
}

async function count(client, table) {
  const result = await client.query(
    `SELECT count(*)::int AS count FROM ${quote(table)}`
  )
  return result.rows[0].count
}

/**
 * Order target tables parent-first using the target database's foreign keys.
 * Self-references (FileNode.parentId) are ignored; COPY checks them at the end
 * of the statement.
 */
async function tableOrder(client, tables) {
  const result = await client.query(`
    SELECT child.relname AS child, parent.relname AS parent
      FROM pg_constraint c
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_namespace n ON n.oid = child.relnamespace
     WHERE c.contype = 'f'
       AND n.nspname = 'public'
       AND child.relname <> parent.relname
  `)
  const allowed = new Set(tables)
  const parents = new Map(tables.map((table) => [table, new Set()]))
  for (const row of result.rows) {
    if (allowed.has(row.child) && allowed.has(row.parent)) {
      parents.get(row.child).add(row.parent)
    }
  }
  const ordered = []
  const remaining = new Set(tables)
  while (remaining.size > 0) {
    let progress = false
    for (const table of [...remaining]) {
      const deps = parents.get(table)
      if ([...deps].every((parent) => !remaining.has(parent))) {
        ordered.push(table)
        remaining.delete(table)
        progress = true
      }
    }
    if (!progress) {
      ordered.push(...remaining)
      break
    }
  }
  return ordered
}

async function targetIsEmpty(client, tables) {
  for (const table of tables) {
    if ((await count(client, table)) > 0) return false
  }
  return true
}

async function truncateTarget(client, tables) {
  if (tables.length === 0) return
  await client.query(`TRUNCATE TABLE ${tables.map(quote).join(", ")} CASCADE`)
  await client.query(
    "SELECT lo_unlink(oid) FROM pg_largeobject_metadata WHERE oid IS NOT NULL"
  )
}

async function copyTable(source, target, table) {
  const cols = await columns(target, table)
  if (cols.length === 0) throw new Error(`Target table ${table} has no columns`)
  const columnList = cols.map(quote).join(", ")
  const read = source.query(
    copyTo(`COPY (SELECT ${columnList} FROM ${quote(table)}) TO STDOUT`)
  )
  const write = target.query(
    copyFrom(`COPY ${quote(table)} (${columnList}) FROM STDIN`)
  )
  await pipeline(read, write)
  return count(target, table)
}

function hashingTransform() {
  const hash = createHash("sha256")
  let size = 0
  return {
    transform: new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk)
        size += chunk.length
        callback(null, chunk)
      },
    }),
    digest() {
      return { size, sha256: hash.digest("hex") }
    },
  }
}

async function readLargeObject(client, oid) {
  await client.query("BEGIN")
  try {
    const manager = new LargeObjectManager({ pg: client })
    const [rawSize, stream] = await manager.openAndReadableStreamAsync(
      oid,
      BUFFER_SIZE
    )
    const hasher = hashingTransform()
    await pipeline(
      stream,
      hasher.transform,
      new Transform({ transform: (_c, _e, cb) => cb() })
    )
    const hash = hasher.digest()
    await client.query("COMMIT")
    return { size: Number(rawSize), sizeBytes: hash.size, sha256: hash.sha256 }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  }
}

async function copyLargeObject(source, target, oid) {
  const existing = await target.query(
    "SELECT 1 FROM pg_largeobject_metadata WHERE oid = $1",
    [oid]
  )
  if (existing.rowCount) return false

  await source.query("BEGIN")
  await target.query("BEGIN")
  try {
    const sourceManager = new LargeObjectManager({ pg: source })
    const targetManager = new LargeObjectManager({ pg: target })
    const [, readStream] = await sourceManager.openAndReadableStreamAsync(
      oid,
      BUFFER_SIZE
    )
    await target.query("SELECT lo_create($1)", [oid])
    const object = await targetManager.openAsync(oid, LargeObjectManager.WRITE)
    const writeStream = object.getWritableStream(BUFFER_SIZE)
    await pipeline(readStream, writeStream)
    await source.query("COMMIT")
    await target.query("COMMIT")
    return true
  } catch (error) {
    await source.query("ROLLBACK").catch(() => undefined)
    await target.query("ROLLBACK").catch(() => undefined)
    throw error
  }
}

async function oidList(client, entry) {
  const sources = OID_SOURCES[entry.key] ?? []
  const oids = new Set()
  for (const source of sources) {
    const result = await client.query(
      `SELECT DISTINCT ${quote(source.column)}::text AS oid
         FROM ${quote(source.table)}
        WHERE ${quote(source.column)} IS NOT NULL`
    )
    for (const row of result.rows) oids.add(Number(row.oid))
  }
  return [...oids].sort((a, b) => a - b)
}

async function copyDatabase(entry, args) {
  const source = new pg.Client({ connectionString: sourceUrl() })
  const target = new pg.Client({ connectionString: targetUrl(entry) })
  await source.connect()
  await target.connect()
  try {
    const tables = targetTables(entry)
    if (!args.truncate && !(await targetIsEmpty(target, tables))) {
      throw new Error(
        `${entry.key} target is not empty; pass --truncate after taking a backup`
      )
    }
    if (args.truncate) await truncateTarget(target, tables)

    const ordered = await tableOrder(target, tables)
    console.log(`\n[${entry.key}] ${ordered.length} tables`)
    for (const table of ordered) {
      const rows = await copyTable(source, target, table)
      console.log(`  ${table}: ${rows}`)
    }

    const oids = await oidList(source, entry)
    if (oids.length > 0) {
      let copied = 0
      for (const oid of oids) {
        if (await copyLargeObject(source, target, oid)) copied += 1
      }
      console.log(`  large objects: ${copied}/${oids.length} copied`)
    }
  } finally {
    await source.end()
    await target.end()
  }
}

async function verifyDatabase(entry) {
  const source = new pg.Client({ connectionString: sourceUrl() })
  const target = new pg.Client({ connectionString: targetUrl(entry) })
  await source.connect()
  await target.connect()
  const errors = []
  try {
    const tables = targetTables(entry)
    for (const table of tables) {
      const [sourceCount, targetCount] = await Promise.all([
        count(source, table),
        count(target, table),
      ])
      if (sourceCount !== targetCount) {
        errors.push(`${table}: source ${sourceCount}, target ${targetCount}`)
      }
    }

    for (const oid of await oidList(source, entry)) {
      const sourceHash = await readLargeObject(source, oid)
      const targetHash = await readLargeObject(target, oid)
      if (
        sourceHash.sizeBytes !== targetHash.sizeBytes ||
        sourceHash.sha256 !== targetHash.sha256
      ) {
        errors.push(`large object ${oid}: hash/size mismatch`)
      }
    }

    const oidRefs = OID_SOURCES[entry.key] ?? []
    for (const source of oidRefs) {
      const result = await target.query(
        `SELECT count(*)::int AS count
           FROM ${quote(source.table)} t
          WHERE t.${quote(source.column)} IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM pg_largeobject_metadata m
               WHERE m.oid = t.${quote(source.column)}
            )`
      )
      if (result.rows[0].count > 0) {
        errors.push(
          `${source.table}.${source.column}: ${result.rows[0].count} missing OIDs`
        )
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `${entry.key} verification failed:\n  ${errors.join("\n  ")}`
      )
    }
    console.log(`verified ${entry.key}`)
  } finally {
    await source.end()
    await target.end()
  }
}

async function dryRun(entries) {
  const source = new pg.Client({ connectionString: sourceUrl() })
  await source.connect()
  try {
    for (const entry of entries) {
      const tables = targetTables(entry)
      let rows = 0
      for (const table of tables) rows += await count(source, table)
      const oids = await oidList(source, entry)
      console.log(
        `[${entry.key}] ${tables.length} tables, ${rows} rows, ${oids.length} large objects`
      )
    }
  } finally {
    await source.end()
  }
}

function snapshot() {
  const dir = join(root, "backups")
  mkdirSync(dir, { recursive: true })
  const file = join(
    dir,
    `monolith-${new Date().toISOString().replaceAll(":", "-")}.dump`
  )
  execFileSync("pg_dump", ["-Fc", "-f", file, sourceUrl()], {
    stdio: "inherit",
  })
  console.log(`snapshot written to ${file}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const entries = selectedDatabases(args)
  if (entries.length === 0) throw new Error("No database selected")

  if (args.snapshot) snapshot()
  if (args.dryRun) await dryRun(entries)
  if (args.copy || args.all) {
    for (const entry of entries) await copyDatabase(entry, args)
  }
  if (args.verify || args.all) {
    for (const entry of entries) await verifyDatabase(entry)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

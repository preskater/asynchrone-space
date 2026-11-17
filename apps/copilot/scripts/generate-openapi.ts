import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { buildOpenApiDocument } from "../lib/public-api/openapi"

/**
 * Writes the committed spec used by the landing docs page and the download
 * link. `--check` fails when the committed file is stale (CI).
 */
const output = fileURLToPath(
  new URL("../../landing/public/downloads/openapi.json", import.meta.url)
)
const spec = `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`

if (process.argv.includes("--check")) {
  let current = ""
  try {
    current = readFileSync(output, "utf8")
  } catch {
    current = ""
  }
  if (current !== spec) {
    console.error(
      "OpenAPI spec is out of date. Run: npm run openapi:generate --workspace=copilot"
    )
    process.exitCode = 1
  } else {
    console.log("OpenAPI spec is up to date.")
  }
} else {
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, spec)
  console.log(`Wrote ${output}`)
}

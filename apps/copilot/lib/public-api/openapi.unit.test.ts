import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { PUBLIC_API_ROUTES } from "@workspace/contracts"

import { buildOpenApiDocument } from "./openapi"

const APP_ROOT = fileURLToPath(new URL("../../app", import.meta.url))
const API_ROOT = join(APP_ROOT, "api/v1")
const COMMITTED_SPEC = fileURLToPath(
  new URL("../../../landing/public/downloads/openapi.json", import.meta.url)
)

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return routeFiles(full)
    return entry.name === "route.ts" ? [full] : []
  })
}

function specPath(file: string): string {
  const path = relative(APP_ROOT, file)
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "")
  return `/${path.replace(/\[([^\]]+)\]/g, "{$1}")}`
}

function exportedMethods(file: string): string[] {
  const source = readFileSync(file, "utf8")
  return [
    ...source.matchAll(/export const (GET|POST|PATCH|DELETE|PUT)\b/g),
  ].map((match) => match[1]!)
}

function implementedOperations(): string[] {
  return routeFiles(API_ROOT).flatMap((file) =>
    exportedMethods(file).map((method) => `${method} ${specPath(file)}`)
  )
}

describe("OpenAPI route coverage", () => {
  it("documents every implemented route and nothing else", () => {
    const implemented = implementedOperations().sort()
    const documented = PUBLIC_API_ROUTES.map(
      (route) => `${route.method} ${route.path}`
    ).sort()
    expect(documented).toEqual(implemented)
  })

  it("uses unique operation ids and paths", () => {
    const ids = PUBLIC_API_ROUTES.map((route) => route.operationId)
    expect(new Set(ids).size).toBe(ids.length)
    const operations = PUBLIC_API_ROUTES.map(
      (route) => `${route.method} ${route.path}`
    )
    expect(new Set(operations).size).toBe(operations.length)
  })

  it("builds an OpenAPI 3.1 document with security and path parameters", () => {
    const document = buildOpenApiDocument()
    expect(document.openapi).toBe("3.1.0")
    const paths = document.paths as Record<string, Record<string, unknown>>

    for (const route of PUBLIC_API_ROUTES) {
      const operation = paths[route.path]?.[route.method.toLowerCase()] as
        | {
            security?: unknown
            parameters?: { in: string; name: string }[]
          }
        | undefined
      expect(operation, `${route.method} ${route.path}`).toBeDefined()
      expect(operation?.security).toEqual([
        { bearerAuth: route.scope ? [route.scope] : [] },
      ])

      const pathParams = (operation?.parameters ?? [])
        .filter((parameter) => parameter.in === "path")
        .map((parameter) => parameter.name)
        .sort()
      const templateParams = [...route.path.matchAll(/\{([^}]+)\}/g)]
        .map((match) => match[1]!)
        .sort()
      expect(pathParams).toEqual(templateParams)
    }
  })

  it("keeps the committed landing spec in sync", () => {
    const committed = JSON.parse(
      readFileSync(COMMITTED_SPEC, "utf8")
    ) as unknown
    expect(committed).toEqual(buildOpenApiDocument())
  })
})

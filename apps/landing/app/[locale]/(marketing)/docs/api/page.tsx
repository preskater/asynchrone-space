import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { Badge } from "@workspace/ui/components/badge"

import { PageHeader } from "@/components/landing/page-header"
import { marketingMetadata } from "@/lib/seo"

import rawSpec from "@/public/downloads/openapi.json"

interface PublicOperation {
  operationId: string
  summary: string
  tags?: string[]
  security?: { bearerAuth?: string[] }[]
}

interface PublicSpec {
  info: { title: string; version: string }
  servers: { url: string; description?: string }[]
  tags: { name: string }[]
  paths: Record<string, Record<string, PublicOperation>>
}

const spec = rawSpec as unknown as PublicSpec

function methodVariant(method: string): "default" | "secondary" | "outline" {
  if (method === "POST") return "default"
  if (method === "GET") return "secondary"
  return "outline"
}

function InfoCard({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function CodeCard({ title, code }: { title: string; code: string }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Api.docs")
  return marketingMetadata({
    path: "/docs/api",
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  })
}

export default async function ApiDocsPage() {
  const t = await getTranslations("Api.docs")
  const tApi = await getTranslations("Api")

  const baseUrl =
    spec.servers.find((server) => server.description === "Production")?.url ??
    "https://asynchrone.space"
  const scopes = [
    ...new Set(
      Object.values(spec.paths).flatMap((methods) =>
        Object.values(methods).flatMap(
          (operation) =>
            operation.security?.flatMap((entry) => entry.bearerAuth ?? []) ?? []
        )
      )
    ),
  ].sort()
  const groups = spec.tags.map((tag) => ({
    name: tag.name,
    label: t(`tags.${tag.name.toLowerCase()}` as never),
    operations: Object.entries(spec.paths).flatMap(([path, methods]) =>
      Object.entries(methods)
        .filter(([, operation]) => operation.tags?.includes(tag.name))
        .map(([method, operation]) => ({
          method: method.toUpperCase(),
          path,
          ...operation,
        }))
    ),
  }))

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
      >
        <a
          href="/downloads/openapi.json"
          download
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          {t("download")}
        </a>
      </PageHeader>

      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-12">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">
              {t("baseUrl")}
            </h2>
            <code className="mt-2 block text-sm text-muted-foreground">
              {baseUrl}
            </code>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">
              {t("authTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("authDescription")}
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold">
            {t("scopesTitle")}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("scopesDescription")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {scopes.map((scope) => (
              <Badge
                key={scope}
                variant="outline"
                className="h-auto gap-2 py-1 text-xs"
              >
                <code>{scope}</code>
                <span className="text-muted-foreground">
                  {tApi(`scopes.${scope}` as never)}
                </span>
              </Badge>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold">
            {t("endpointsTitle")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("endpointsDescription")}
          </p>
          <div className="mt-6 flex flex-col gap-8">
            {groups.map((group) => (
              <div key={group.name}>
                <h3 className="font-heading text-lg font-semibold">
                  {group.label}
                </h3>
                <div className="mt-3 flex flex-col divide-y rounded-xl border">
                  {group.operations.map((operation) => {
                    const scope = operation.security?.[0]?.bearerAuth?.[0]
                    return (
                      <div
                        key={`${operation.method} ${operation.path}`}
                        className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge
                            variant={methodVariant(operation.method)}
                            className="font-mono"
                          >
                            {operation.method}
                          </Badge>
                          <code className="text-sm">{operation.path}</code>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span>{operation.summary}</span>
                          <Badge variant="outline">
                            {scope ?? t("noScope")}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <InfoCard
            title={t("paginationTitle")}
            description={t("paginationDescription")}
          />
          <InfoCard
            title={t("rateLimitsTitle")}
            description={t("rateLimitsDescription")}
          />
        </section>

        <section>
          <h2 className="font-heading text-2xl font-semibold">
            {t("errorsTitle")}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("errorsDescription")}</p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-relaxed">
            <code>{`{
  "error": {
    "code": "insufficient_scope",
    "message": "This token lacks the projects:write scope."
  },
  "meta": { "requestId": "…" }
}`}</code>
          </pre>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <CodeCard
            title={t("curlTitle")}
            code={`curl "${baseUrl}/api/v1/projects" \\\n  -H "Authorization: Bearer async_…"`}
          />
          <CodeCard
            title={t("typescriptTitle")}
            code={`const response = await fetch("${baseUrl}/api/v1/projects", {\n  headers: {\n    Authorization: \`Bearer \${process.env.ASYNCHRONE_TOKEN}\`,\n  },\n})\nconst { data, meta } = await response.json()`}
          />
        </section>
      </div>
    </>
  )
}

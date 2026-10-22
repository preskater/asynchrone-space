import Link from "next/link"

import { prisma } from "@workspace/db"
import { Badge } from "@workspace/ui/components/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { PageHeader } from "@/components/page-header"
import { StatCard } from "@/components/stat-card"
import {
  formatDateTime,
  formatNumber,
  formatRelative,
} from "@/lib/platform/format"
import { requirePlatformContext } from "@/lib/platform/guard"

export const metadata = { title: "Operations" }

const OPEN = "open"
const PENDING = "pending"

export default async function OperationsPage() {
  await requirePlatformContext()

  const now = new Date()
  const startedAt = Date.now()
  await prisma.$queryRaw`SELECT 1`
  const latency = Date.now() - startedAt

  const [
    activeSessions,
    expiredSessions,
    openUploads,
    staleUploads,
    pendingInvitations,
    repositoryConnections,
    repositories,
    jwks,
    oauthClients,
    disabledOauthClients,
  ] = await Promise.all([
    prisma.session.count({ where: { expiresAt: { gt: now } } }),
    prisma.session.count({ where: { expiresAt: { lte: now } } }),
    prisma.uploadSession.count({ where: { status: OPEN } }),
    prisma.uploadSession.findMany({
      where: { status: OPEN, expiresAt: { lt: now } },
      orderBy: { expiresAt: "asc" },
      take: 10,
      select: {
        id: true,
        organizationId: true,
        userId: true,
        name: true,
        receivedBytes: true,
        expectedSize: true,
        expiresAt: true,
      },
    }),
    prisma.invitation.count({ where: { status: PENDING } }),
    prisma.repositoryConnection.count(),
    prisma.repositoryConnection.findMany({
      orderBy: { lastSyncedAt: "asc" },
      take: 10,
      select: {
        id: true,
        organizationId: true,
        provider: true,
        owner: true,
        repo: true,
        lastSyncedAt: true,
      },
    }),
    prisma.jwks.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, alg: true, createdAt: true, expiresAt: true },
    }),
    prisma.oauthClient.count(),
    prisma.oauthClient.count({ where: { disabled: true } }),
  ])

  const neverSynced = await prisma.repositoryConnection.count({
    where: { lastSyncedAt: null },
  })

  const lastSync = repositories
    .map((repository) => repository.lastSyncedAt)
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations"
        description="Live signals from the shared database. No historical metrics are stored yet."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Database latency"
          value={`${latency} ms`}
          hint={`Pool max ${process.env.DATABASE_POOL_MAX ?? "3"} per instance`}
        />
        <StatCard
          label="Active sessions"
          value={formatNumber(activeSessions)}
          hint={`${formatNumber(expiredSessions)} expired rows`}
        />
        <StatCard
          label="Open uploads"
          value={formatNumber(openUploads)}
          hint={`${staleUploads.length} past their lease`}
        />
        <StatCard
          label="Pending invitations"
          value={formatNumber(pendingInvitations)}
        />
        <StatCard
          label="Repository connections"
          value={formatNumber(repositoryConnections)}
          hint={`${formatNumber(neverSynced)} never synced`}
        />
        <StatCard
          label="Last repository sync"
          value={lastSync ? formatRelative(lastSync) : "never"}
        />
        <StatCard
          label="Signing keys"
          value={formatNumber(jwks.length)}
          hint={
            jwks[0]?.expiresAt
              ? `newest expires ${formatRelative(jwks[0].expiresAt)}`
              : "no key"
          }
        />
        <StatCard
          label="MCP / OAuth clients"
          value={formatNumber(oauthClients)}
          hint={`${formatNumber(disabledOauthClients)} disabled`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Stale uploads</h2>
          <p className="text-xs text-muted-foreground">
            Open sessions past their lease. The daily sweep unlinks them.
          </p>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-end">Expired</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staleUploads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No stale upload.
                    </TableCell>
                  </TableRow>
                ) : (
                  staleUploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{upload.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {upload.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatNumber(upload.receivedBytes)}
                        {upload.expectedSize
                          ? ` / ${formatNumber(upload.expectedSize)}`
                          : ""}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {formatRelative(upload.expiresAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Repository sync lag</h2>
          <p className="text-xs text-muted-foreground">
            Connections ordered by oldest sync. The hourly cron refreshes them.
          </p>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-end">Last sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repositories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No connected repository.
                    </TableCell>
                  </TableRow>
                ) : (
                  repositories.map((repository) => (
                    <TableRow key={repository.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {repository.owner}/{repository.repo}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {repository.provider}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/organizations/${repository.organizationId}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {repository.organizationId}
                        </Link>
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {repository.lastSyncedAt
                          ? formatRelative(repository.lastSyncedAt)
                          : "never"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Signing keys</h2>
        <p className="text-xs text-muted-foreground">
          Shared JWKS rows used by MCP tokens. Only public metadata is read here.
        </p>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Algorithm</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-end">Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jwks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No signing key stored.
                  </TableCell>
                </TableRow>
              ) : (
                jwks.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-mono text-xs">{key.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{key.alg}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(key.createdAt)}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatDateTime(key.expiresAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Environment {process.env.DEPLOY_ENV ?? process.env.NODE_ENV ?? "unknown"}
        {process.env.GIT_COMMIT_SHA
          ? ` · commit ${process.env.GIT_COMMIT_SHA.slice(0, 7)}`
          : ""}
      </p>
    </div>
  )
}

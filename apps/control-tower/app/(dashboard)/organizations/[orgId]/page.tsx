import Link from "next/link"
import { notFound } from "next/navigation"

import { ExternalLink } from "lucide-react"

import { prisma } from "@workspace/db"
import { entitlementsFor, monthWindow } from "@workspace/db/plans"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { PageHeader } from "@/components/page-header"
import { OAuthClientToggle } from "@/components/oauth-client-toggle"
import { PlanForm } from "@/components/plan-form"
import { StatCard } from "@/components/stat-card"
import {
  formatBytes,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatUsdMicros,
} from "@/lib/platform/format"
import { requirePlatformContext } from "@/lib/platform/guard"
import {
  enforcedPlan,
  orgQuotaBytes,
  storedPlan,
  trialSummary,
  usagePercent,
} from "@/lib/platform/plan"

export const metadata = { title: "Organization" }

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const context = await requirePlatformContext()

  const { orgId } = await params

  const organization = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      slug: true,
      metadata: true,
      storageQuotaBytes: true,
      trialStartedAt: true,
      trialEndsAt: true,
      createdAt: true,
      subscription: {
        select: {
          plan: true,
          status: true,
          provider: true,
          billingInterval: true,
          currentPeriodEnd: true,
          trialEndsAt: true,
          cancelAtPeriodEnd: true,
          manualOverride: true,
          providerCustomerId: true,
          providerSubscriptionId: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          members: true,
          projects: true,
          tasks: true,
          clients: true,
          deals: true,
          files: true,
          repositoryConnections: true,
        },
      },
    },
  })

  if (!organization) notFound()

  const month = monthWindow()
  const previousMonth = monthWindow(
    new Date(month.start.getTime() - 24 * 60 * 60 * 1000)
  )
  const [
    storage,
    members,
    repositories,
    oauthClients,
    auditLogs,
    platformEvents,
    aiThisMonth,
    aiLastMonth,
    seats,
  ] = await Promise.all([
    prisma.fileNode.aggregate({
      where: { organizationId: orgId, trashed: false },
      _sum: { sizeBytes: true },
    }),
    prisma.member.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        role: true,
        clientId: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            banned: true,
          },
        },
      },
    }),
    prisma.repositoryConnection.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        provider: true,
        owner: true,
        repo: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    }),
    prisma.oauthClient.findMany({
      where: { referenceId: orgId },
      orderBy: { createdAt: "desc" },
      select: { clientId: true, name: true, disabled: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorId: true,
        createdAt: true,
      },
    }),
    prisma.platformAuditEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        actorRole: true,
        targetType: true,
        targetId: true,
        createdAt: true,
      },
    }),
    prisma.aiUsageEvent.aggregate({
      where: { organizationId: orgId, createdAt: { gte: month.start } },
      _sum: { costMicros: true, inputTokens: true, outputTokens: true },
      _count: true,
    }),
    prisma.aiUsageEvent.aggregate({
      where: {
        organizationId: orgId,
        createdAt: { gte: previousMonth.start, lt: month.start },
      },
      _sum: { costMicros: true },
    }),
    prisma.member.count({ where: { organizationId: orgId, clientId: null } }),
  ])

  const used = Number(storage._sum.sizeBytes ?? 0)
  const quota = orgQuotaBytes(organization)
  const percent = usagePercent(used, quota)
  const aiSpent = aiThisMonth._sum.costMicros ?? 0
  const aiTokens =
    (aiThisMonth._sum.inputTokens ?? 0) + (aiThisMonth._sum.outputTokens ?? 0)
  const plan = enforcedPlan(organization)
  const stored = storedPlan(organization)
  const trial = trialSummary(organization)
  // Back on the stored plan after a trial that is no longer running.
  const trialEnded =
    !trial && organization.trialStartedAt !== null && stored === "free"
  const aiBudget = entitlementsFor(plan).aiBudgetMicrosPerSeat * seats

  return (
    <div className="space-y-6">
      <PageHeader
        title={organization.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{organization.slug}</span>
            <Badge
              variant={plan === "free" ? "outline" : "secondary"}
              className="capitalize"
            >
              {plan}
            </Badge>
            {trial ? (
              <Badge variant="outline">
                trial · {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"}{" "}
                left
              </Badge>
            ) : trialEnded ? (
              <Badge variant="outline">trial ended</Badge>
            ) : null}
            {trial ? (
              <span className="text-xs text-muted-foreground">
                · ends {formatDate(trial.endsAt)}
              </span>
            ) : null}
            <span>· created {formatDate(organization.createdAt)}</span>
            <span className="font-mono text-xs">· {organization.id}</span>
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={`${(process.env.PLATFORM_APP_URL ?? "").replace(/\/$/, "")}/${organization.slug}`}
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Open in app
            <ExternalLink />
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Storage"
          value={formatBytes(used)}
          hint={`${percent}% of ${formatBytes(quota)}${organization.storageQuotaBytes !== null ? " (override)" : ""}`}
        />
        <StatCard
          label="Members"
          value={formatNumber(organization._count.members)}
        />
        <StatCard
          label="Projects"
          value={formatNumber(organization._count.projects)}
        />
        <StatCard
          label="Tasks"
          value={formatNumber(organization._count.tasks)}
        />
        <StatCard
          label="Clients"
          value={formatNumber(organization._count.clients)}
        />
        <StatCard
          label="Deals"
          value={formatNumber(organization._count.deals)}
        />
        <StatCard
          label="AI spend this month"
          value={formatUsdMicros(aiSpent)}
          hint={`${usagePercent(aiSpent, aiBudget)}% of ${formatUsdMicros(aiBudget)} · ${formatNumber(aiTokens)} tokens in ${formatNumber(aiThisMonth._count)} runs · last month ${formatUsdMicros(aiLastMonth._sum.costMicros ?? 0)}`}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Plan & quota</h2>
        <div className="rounded-xl border bg-card p-4">
          <PlanForm
            organizationId={organization.id}
            plan={stored}
            quotaBytes={
              organization.storageQuotaBytes === null
                ? null
                : Number(organization.storageQuotaBytes)
            }
            subscription={organization.subscription}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Members</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-end">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No members.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <Link
                        href={`/users/${member.user.id}`}
                        className="flex flex-col hover:underline"
                      >
                        <span className="font-medium">{member.user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {member.user.email}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.clientId ? (
                        <Badge variant="secondary">Portal</Badge>
                      ) : (
                        <span className="text-muted-foreground">Workspace</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatDate(member.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Repositories</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Repository</TableHead>
                  <TableHead className="text-end">Last sync</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repositories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
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

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">MCP / OAuth clients</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Created</TableHead>
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {oauthClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      No OAuth client registered for this organization.
                    </TableCell>
                  </TableRow>
                ) : (
                  oauthClients.map((client) => (
                    <TableRow key={client.clientId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{client.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {client.clientId}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={client.disabled ? "destructive" : "outline"}
                        >
                          {client.disabled ? "disabled" : "active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {formatDate(client.createdAt)}
                      </TableCell>
                      <TableCell className="text-end">
                        <OAuthClientToggle
                          clientId={client.clientId}
                          disabled={Boolean(client.disabled)}
                          canManage={context.role === "platform_admin"}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Recent organization audit</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="text-end">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No audit entries.
                    </TableCell>
                  </TableRow>
                ) : (
                  auditLogs.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.action}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.entityType}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {formatRelative(entry.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Platform actions</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead className="text-end">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platformEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No platform action recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  platformEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        {event.action}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.actorEmail}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        <span title={formatDateTime(event.createdAt)}>
                          {formatRelative(event.createdAt)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  )
}

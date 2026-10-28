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
import { cn } from "@workspace/ui/lib/utils"

import { PageHeader } from "@/components/page-header"
import { formatDateTime, formatRelative } from "@/lib/platform/format"
import { readString, type SearchParams } from "@/lib/platform/params"
import { requirePlatformContext } from "@/lib/platform/guard"

export const metadata = { title: "Audit" }

const TABS = [
  { value: "platform", label: "Platform actions", href: "/audit" },
  { value: "org", label: "Organization audit", href: "/audit?source=org" },
] as const

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePlatformContext()

  const params = await searchParams
  const source = readString(params, "source") === "org" ? "org" : "platform"

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit"
        description="Latest 100 events. Platform actions are written by the control tower; organization audit is written by the customer app."
      />

      <div className="flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              source === tab.value && "bg-muted text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {source === "platform" ? (
        <PlatformAuditTable />
      ) : (
        <OrganizationAuditTable />
      )}
    </div>
  )
}

async function PlatformAuditTable() {
  const events = await prisma.platformAuditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      actorEmail: true,
      actorRole: true,
      targetType: true,
      targetId: true,
      organizationId: true,
      createdAt: true,
    },
  })

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Organization</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No platform action recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  <span title={formatDateTime(event.createdAt)}>
                    {formatRelative(event.createdAt)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{event.actorEmail}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {event.actorRole.replace("platform_", "")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">{event.action}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{event.targetType}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {event.targetId}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {event.organizationId ? (
                    <Link
                      href={`/organizations/${event.organizationId}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {event.organizationId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

async function OrganizationAuditTable() {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      actorId: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  })

  const actorIds = [...new Set(entries.map((entry) => entry.actorId))]
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  })
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]))

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No organization audit entry recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            entries.map((entry) => {
              const actor = actorsById.get(entry.actorId)

              return (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    <span title={formatDateTime(entry.createdAt)}>
                      {formatRelative(entry.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/organizations/${entry.organization.id}`}
                      className="font-medium hover:underline"
                    >
                      {entry.organization.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {actor ? (
                      <div className="flex flex-col">
                        <span>{actor.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {actor.email}
                        </span>
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        {entry.actorId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.entityType}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}

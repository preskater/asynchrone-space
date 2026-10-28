import { Building2, HardDrive, Timer, Users } from "lucide-react"

import { prisma } from "@workspace/db"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { StatCard } from "@/components/stat-card"
import { formatBytes, formatDate, formatNumber, formatRelative } from "@/lib/platform/format"
import { requirePlatformContext } from "@/lib/platform/guard"

export const metadata = { title: "Overview" }

export default async function OverviewPage() {
  await requirePlatformContext()

  const now = new Date()
  const [organizations, users, activeSessions, storage, recent] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.session.count({ where: { expiresAt: { gt: now } } }),
    prisma.fileNode.aggregate({
      where: { trashed: false },
      _sum: { sizeBytes: true },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide state across every organization.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Organizations"
          value={formatNumber(organizations)}
          icon={Building2}
        />
        <StatCard label="Users" value={formatNumber(users)} icon={Users} />
        <StatCard
          label="Active sessions"
          value={formatNumber(activeSessions)}
          hint="Unexpired sessions across all apps"
          icon={Timer}
        />
        <StatCard
          label="Stored files"
          value={formatBytes(Number(storage._sum.sizeBytes ?? 0))}
          hint="PostgreSQL large objects, trashed excluded"
          icon={HardDrive}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Newest organizations</h2>
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-end">Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No organizations yet.
                  </TableCell>
                </TableRow>
              ) : (
                recent.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{organization.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {organization.slug}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatNumber(organization._count.members)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(organization.createdAt)}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatRelative(organization.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

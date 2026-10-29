import Link from "next/link"

import { prisma, type Prisma } from "@workspace/db"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { PageHeader } from "@/components/page-header"
import { Pagination } from "@/components/pagination"
import { formatBytes, formatDate, formatNumber } from "@/lib/platform/format"
import { PAGE_SIZE, readPage, readString, type SearchParams } from "@/lib/platform/params"
import {
  enforcedPlan,
  orgQuotaBytes,
  usagePercent,
} from "@/lib/platform/plan"
import { requirePlatformContext } from "@/lib/platform/guard"

export const metadata = { title: "Organizations" }

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePlatformContext()

  const params = await searchParams
  const query = readString(params, "q").trim()
  const page = readPage(params)

  const where: Prisma.OrganizationWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      }
    : {}

  const [total, organizations] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        storageQuotaBytes: true,
        metadata: true,
        trialEndsAt: true,
        _count: { select: { members: true, projects: true, tasks: true } },
      },
    }),
  ])

  const usage =
    organizations.length > 0
      ? await prisma.fileNode.groupBy({
          by: ["organizationId"],
          where: {
            organizationId: { in: organizations.map((organization) => organization.id) },
            trashed: false,
          },
          _sum: { sizeBytes: true },
        })
      : []

  const usedByOrg = new Map(
    usage.map((row) => [row.organizationId, row._sum.sizeBytes ?? 0])
  )
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organizations"
        description={`${formatNumber(total)} organization${total === 1 ? "" : "s"} across the platform.`}
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search name or slug…"
          className="max-w-xs"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
        {query ? (
          <Button variant="ghost" nativeButton={false} render={<Link href="/organizations" />}>
            Clear
          </Button>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-end">Members</TableHead>
              <TableHead className="text-end">Projects</TableHead>
              <TableHead>Storage</TableHead>
              <TableHead className="text-end">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No organization matches this search.
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((organization) => {
                const used = usedByOrg.get(organization.id) ?? 0
                const quota = orgQuotaBytes(organization)
                const percent = usagePercent(used, quota)

                return (
                  <TableRow key={organization.id}>
                    <TableCell>
                      <Link
                        href={`/organizations/${organization.id}`}
                        className="flex flex-col hover:underline"
                      >
                        <span className="font-medium">{organization.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {organization.slug}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          enforcedPlan(organization) === "free"
                            ? "outline"
                            : "secondary"
                        }
                        className="capitalize"
                      >
                        {enforcedPlan(organization)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(organization._count.members)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {formatNumber(organization._count.projects)}
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-40 flex-col gap-1">
                        <span className="text-xs tabular-nums">
                          {formatBytes(used)} / {formatBytes(quota)}
                        </span>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatDate(organization.createdAt)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        basePath="/organizations"
        page={page}
        pageCount={pageCount}
        query={query ? { q: query } : {}}
        total={total}
      />
    </div>
  )
}

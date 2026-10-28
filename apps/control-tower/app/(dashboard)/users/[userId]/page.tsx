import Link from "next/link"
import { notFound } from "next/navigation"

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
import { UserActions } from "@/components/user-actions"
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
} from "@/lib/platform/format"
import { requirePlatformContext } from "@/lib/platform/guard"
import { parsePlatformRoles } from "@/lib/platform/roles"

export const metadata = { title: "User" }

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const context = await requirePlatformContext()

  const { userId } = await params

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      banned: true,
      banReason: true,
      banExpires: true,
      role: true,
      lastSeenAt: true,
      createdAt: true,
    },
  })

  if (!user) notFound()

  const now = new Date()
  const [memberships, sessions, accounts, oauthClients, platformEvents] =
    await Promise.all([
      prisma.member.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          clientId: true,
          createdAt: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.session.findMany({
        where: { userId, expiresAt: { gt: now } },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          expiresAt: true,
          ipAddress: true,
          userAgent: true,
          impersonatedBy: true,
        },
      }),
      prisma.account.findMany({
        where: { userId },
        select: { providerId: true, createdAt: true },
      }),
      prisma.oauthClient.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { clientId: true, name: true, disabled: true, createdAt: true },
      }),
      prisma.platformAuditEvent.findMany({
        where: { targetType: "user", targetId: userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, action: true, actorEmail: true, createdAt: true },
      }),
    ])

  const platformRoles = parsePlatformRoles(user.role)

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{user.email}</span>
            <Badge variant={user.emailVerified ? "outline" : "secondary"}>
              {user.emailVerified ? "verified" : "pending"}
            </Badge>
            {user.banned ? <Badge variant="destructive">banned</Badge> : null}
            {platformRoles.map((role) => (
              <Badge key={role} variant="secondary">
                {role.replace("platform_", "")}
              </Badge>
            ))}
            <span className="font-mono text-xs">· {user.id}</span>
          </span>
        }
        actions={
          <UserActions
            userId={user.id}
            banned={Boolean(user.banned)}
            canImpersonate={context.role === "platform_admin"}
          />
        }
      />

      {user.banned ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Account banned</p>
          <p className="text-muted-foreground">
            {user.banReason ?? "No reason recorded."}
            {user.banExpires
              ? ` · expires ${formatDateTime(user.banExpires)}`
              : " · permanent"}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Organizations"
          value={formatNumber(memberships.length)}
        />
        <StatCard label="Active sessions" value={formatNumber(sessions.length)} />
        <StatCard label="Linked accounts" value={formatNumber(accounts.length)} />
        <StatCard label="MCP clients" value={formatNumber(oauthClients.length)} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Memberships</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Access</TableHead>
                <TableHead className="text-end">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    This account is not a member of any organization.
                  </TableCell>
                </TableRow>
              ) : (
                memberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell>
                      <Link
                        href={`/organizations/${membership.organization.id}`}
                        className="flex flex-col hover:underline"
                      >
                        <span className="font-medium">
                          {membership.organization.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {membership.organization.slug}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {membership.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {membership.clientId ? (
                        <Badge variant="secondary">Portal</Badge>
                      ) : (
                        <span className="text-muted-foreground">Workspace</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatDate(membership.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Active sessions</h2>
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Impersonated</TableHead>
                <TableHead className="text-end">Last used</TableHead>
                <TableHead className="text-end">Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No active session.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="max-w-64">
                      <span className="line-clamp-1 text-muted-foreground">
                        {session.userAgent ?? "Unknown client"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {session.ipAddress ?? "—"}
                    </TableCell>
                    <TableCell>
                      {session.impersonatedBy ? (
                        <Badge variant="destructive">yes</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      <span title={formatDateTime(session.updatedAt)}>
                        {formatRelative(session.updatedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-end text-muted-foreground">
                      {formatDateTime(session.expiresAt)}
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
          <h2 className="text-sm font-semibold">Linked accounts</h2>
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-end">Linked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No linked account.
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((account) => (
                    <TableRow key={account.providerId}>
                      <TableCell className="capitalize">
                        {account.providerId}
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {formatDate(account.createdAt)}
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {oauthClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No OAuth client registered by this user.
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
                        <Badge variant={client.disabled ? "destructive" : "outline"}>
                          {client.disabled ? "disabled" : "active"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {formatDate(client.createdAt)}
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
        <h2 className="text-sm font-semibold">Platform actions on this account</h2>
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
                    <TableCell className="font-medium">{event.action}</TableCell>
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

      <p className="text-xs text-muted-foreground">
        Created {formatDateTime(user.createdAt)}
        {user.lastSeenAt ? ` · last seen ${formatDateTime(user.lastSeenAt)}` : ""}
      </p>
    </div>
  )
}

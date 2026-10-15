import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/core/errors"
import type { RequestContext } from "@/lib/core/context"
import type { PrismaClient } from "@/lib/generated/prisma/client"
import { ROLE_RANK } from "@/lib/organization/roles"

import { decryptSecret, encryptSecret, generateWebhookSecret } from "./crypto"
import { createProviderClient } from "./providers"
import type {
  RepositoryConnectionRepository,
  RepositoryConnectionRow,
} from "./repository"
import {
  closeIssueForTask,
  ensurePullRequestForTask,
  issueStateForStatus,
  pushNewTask,
  pushTaskContent,
  pushTaskState,
  syncConnection,
} from "./sync"
import type {
  ConnectRepositoryInput,
  ConnectRepositoryResult,
  RepositoryConnectionView,
  RepositoryProvider,
  RepositorySyncSummary,
} from "./types"

/** Fields of a task write that the repository sync cares about. */
export interface TaskSyncUpdate {
  title?: boolean
  description?: boolean
  status?: { from: string; to: string }
}

/**
 * The task panel persists title/description per keystroke; remote content
 * pushes are coalesced for this long after the last edit. Status changes are
 * pushed immediately (they drive closing and PR creation).
 */
const CONTENT_PUSH_DEBOUNCE_MS = 2_000

/**
 * Two-way sync between project tasks and GitHub/GitLab issues.
 *
 * Repository writes triggered by user actions are best effort: a GitHub
 * outage must never fail the local task edit. The hooks therefore log and
 * swallow provider errors; explicit "Sync now"/connect runs surface them.
 */
export class RepositoryIntegrationService {
  private readonly contentPushTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >

  constructor(
    private readonly repo: RepositoryConnectionRepository,
    private readonly db: PrismaClient
  ) {}

  private canManage(ctx: RequestContext) {
    if ((ROLE_RANK[ctx.role] ?? 0) >= 3) return
    throw new ForbiddenError(
      "Your role cannot manage repository connections.",
      { code: "role_cannot_manage_integrations" }
    )
  }

  private async projectExists(ctx: RequestContext, projectId: string) {
    const project = await this.db.project.findFirst({
      where: { id: projectId, organizationId: ctx.organizationId },
      select: { id: true },
    })
    if (!project) throw new NotFoundError("Project")
  }

  private toView(connection: RepositoryConnectionRow): RepositoryConnectionView {
    const appUrl = process.env.BETTER_AUTH_URL ?? ""
    return {
      id: connection.id,
      projectId: connection.projectId,
      provider: connection.provider as RepositoryProvider,
      owner: connection.owner,
      repo: connection.repo,
      repoUrl: connection.repoUrl,
      baseUrl: connection.baseUrl ?? undefined,
      webhookUrl: `${appUrl}/api/webhooks/repositories/${connection.id}`,
      webhookSecret: connection.webhookSecret,
      createdById: connection.createdById,
      lastSyncedAt: connection.lastSyncedAt?.toISOString(),
      createdAt: connection.createdAt.toISOString(),
    }
  }

  /**
   * Token used for provider calls: the acting user's linked account wins so
   * their avatar signs the issue/PR, otherwise the connection token (always
   * used by webhooks and scheduled syncs, which have no user).
   */
  private async resolveToken(
    connection: RepositoryConnectionRow,
    actorUserId?: string
  ): Promise<string> {
    if (actorUserId) {
      const account = await this.db.account.findFirst({
        where: {
          userId: actorUserId,
          providerId: connection.provider,
          accessToken: { not: null },
        },
        orderBy: { updatedAt: "desc" },
        select: { accessToken: true },
      })
      if (account?.accessToken) return account.accessToken
    }
    return decryptSecret(connection.accessToken)
  }

  /** Runs a repository write without letting provider errors break the caller. */
  private async bestEffort(context: string, run: () => Promise<void>) {
    try {
      await run()
    } catch (error) {
      console.error(`[repository-sync] ${context}`, error)
    }
  }

  /** Coalesces per-keystroke content edits into a single remote push. */
  private scheduleContentPush(taskId: string, actorUserId: string) {
    const previous = this.contentPushTimers.get(taskId)
    if (previous) clearTimeout(previous)
    const timer = setTimeout(() => {
      this.contentPushTimers.delete(taskId)
      void this.bestEffort("task content", async () => {
        const task = await this.db.task.findUnique({ where: { id: taskId } })
        if (!task) return
        const connection = await this.connectionForProject(
          task.organizationId,
          task.projectId
        )
        if (!connection) return
        const token = await this.resolveToken(connection, actorUserId)
        await pushTaskContent(this.db, connection, task, token)
      })
    }, CONTENT_PUSH_DEBOUNCE_MS)
    this.contentPushTimers.set(taskId, timer)
  }

  async getConnection(
    ctx: RequestContext,
    projectId: string
  ): Promise<RepositoryConnectionView | null> {
    this.canManage(ctx)
    const connection = await this.repo.findByProject(ctx.organizationId, projectId)
    return connection ? this.toView(connection) : null
  }

  async connect(
    ctx: RequestContext,
    input: ConnectRepositoryInput
  ): Promise<ConnectRepositoryResult> {
    this.canManage(ctx)
    await this.projectExists(ctx, input.projectId)

    const owner = input.owner.trim().replace(/^\/+|\/+$/g, "")
    const repo = input.repo.trim().replace(/\.git$/i, "")
    const baseUrl = input.baseUrl?.trim()
      ? input.baseUrl.trim().replace(/\/+$/, "")
      : null

    if (await this.repo.findByProject(ctx.organizationId, input.projectId)) {
      throw new ConflictError(
        "This project already has a repository connected.",
        { code: "repository_already_connected" }
      )
    }
    if (
      await this.repo.findByRepo(
        ctx.organizationId,
        input.provider,
        owner,
        repo
      )
    ) {
      throw new ConflictError(
        "This repository is already connected to another project.",
        { code: "repository_already_connected" }
      )
    }

    // Validate the credentials and the repository before storing anything.
    const probe = createProviderClient({
      provider: input.provider,
      baseUrl,
      owner,
      repo,
      accessToken: input.accessToken,
      webhookSecret: "",
    })
    let remote
    try {
      remote = await probe.api.getRepository()
    } catch (error) {
      console.error("[repository-sync] connect probe failed", error)
      throw new ValidationError(
        "Could not reach the repository. Check the owner, name and access token.",
        undefined,
        { code: "repository_connect_failed" }
      )
    }

    const connection = await this.repo.create({
      organizationId: ctx.organizationId,
      projectId: input.projectId,
      provider: input.provider,
      baseUrl,
      owner: remote.owner,
      repo: remote.repo,
      repoUrl: remote.url,
      accessToken: encryptSecret(input.accessToken),
      webhookSecret: generateWebhookSecret(),
      createdById: ctx.userId,
    })

    // Backfill in both directions; keep the connection when it fails so the
    // admin can retry with "Sync now" instead of re-entering the token.
    let summary: RepositorySyncSummary = {
      issuesImported: 0,
      issuesUpdated: 0,
      tasksPushed: 0,
    }
    try {
      summary = await syncConnection(this.db, connection, input.accessToken)
    } catch (error) {
      console.error("[repository-sync] initial sync failed", error)
    }

    const fresh = (await this.repo.findById(connection.id)) ?? connection
    return { connection: this.toView(fresh), summary }
  }

  async disconnect(
    ctx: RequestContext,
    projectId: string
  ): Promise<{ id: string }> {
    this.canManage(ctx)
    const connection = await this.repo.findByProject(ctx.organizationId, projectId)
    if (!connection) {
      throw new ValidationError("No repository is connected.", undefined, {
        code: "repository_not_connected",
      })
    }
    await this.repo.delete(connection.id)
    return { id: connection.id }
  }

  /** Manual reconciliation from the settings tab; errors surface to the user. */
  async sync(
    ctx: RequestContext,
    projectId: string
  ): Promise<RepositorySyncSummary> {
    this.canManage(ctx)
    const connection = await this.repo.findByProject(ctx.organizationId, projectId)
    if (!connection) {
      throw new ValidationError("No repository is connected.", undefined, {
        code: "repository_not_connected",
      })
    }
    const token = await this.resolveToken(connection, ctx.userId)
    return syncConnection(this.db, connection, token)
  }

  /** Cron entry point: reconciles every connection, isolating failures. */
  async syncAllConnections(): Promise<{ synced: number; failed: number }> {
    const connections = await this.repo.listAll()
    const result = { synced: 0, failed: 0 }
    for (const connection of connections) {
      try {
        const token = await this.resolveToken(connection)
        await syncConnection(this.db, connection, token)
        result.synced += 1
      } catch (error) {
        result.failed += 1
        console.error(
          `[repository-sync] scheduled sync failed for ${connection.id}`,
          error
        )
      }
    }
    return result
  }

  // -------------------------------------------------------------------------
  // Project-service hooks (fire-and-forget from the caller's perspective)
  // -------------------------------------------------------------------------

  private connectionForProject(organizationId: string, projectId: string) {
    return this.repo.findByProject(organizationId, projectId)
  }

  /** A task was created: report it to the connected repository as an issue. */
  async onTaskCreated(taskId: string, actorUserId: string): Promise<void> {
    await this.bestEffort("task create", async () => {
      const task = await this.db.task.findUnique({ where: { id: taskId } })
      if (!task) return
      const connection = await this.connectionForProject(
        task.organizationId,
        task.projectId
      )
      if (!connection) return
      const token = await this.resolveToken(connection, actorUserId)
      await pushNewTask(this.db, connection, task, token)
    })
  }

  /**
   * A task was edited: push changed title/description, mirror status changes
   * that cross the done boundary, and open a pull request on "review".
   */
  async onTaskUpdated(
    taskId: string,
    update: TaskSyncUpdate,
    actorUserId: string
  ): Promise<void> {
    await this.bestEffort("task update", async () => {
      const task = await this.db.task.findUnique({ where: { id: taskId } })
      if (!task) return
      const connection = await this.connectionForProject(
        task.organizationId,
        task.projectId
      )
      if (!connection) return
      if (update.title || update.description) {
        this.scheduleContentPush(taskId, actorUserId)
      }
      const crossesDoneBoundary =
        update.status &&
        issueStateForStatus(update.status.from) !==
          issueStateForStatus(update.status.to)
      if (crossesDoneBoundary) {
        const token = await this.resolveToken(connection, actorUserId)
        await pushTaskState(this.db, connection, task, token)
      }
      if (update.status?.to === "review") {
        const token = await this.resolveToken(connection, actorUserId)
        const fresh = await this.db.task.findUnique({ where: { id: taskId } })
        if (fresh) await ensurePullRequestForTask(this.db, connection, fresh, token)
      }
    })
  }

  /** A task was moved between columns (board drag & drop). */
  async onTaskMoved(
    taskId: string,
    status: string,
    actorUserId: string
  ): Promise<void> {
    await this.bestEffort("task move", async () => {
      const task = await this.db.task.findUnique({ where: { id: taskId } })
      if (!task) return
      const connection = await this.connectionForProject(
        task.organizationId,
        task.projectId
      )
      if (!connection) return
      const token = await this.resolveToken(connection, actorUserId)
      await pushTaskState(this.db, connection, task, token)
      if (status === "review") {
        await ensurePullRequestForTask(this.db, connection, task, token)
      }
    })
  }

  /** A task was deleted: close its issue so the next sync won't resurrect it. */
  async onTaskDeleted(
    task: {
      organizationId: string
      projectId: string
      externalIssueNumber: number | null
    },
    actorUserId: string
  ): Promise<void> {
    await this.bestEffort("task delete", async () => {
      if (!task.externalIssueNumber) return
      const connection = await this.connectionForProject(
        task.organizationId,
        task.projectId
      )
      if (!connection) return
      const token = await this.resolveToken(connection, actorUserId)
      await closeIssueForTask(connection, task.externalIssueNumber, token)
    })
  }
}

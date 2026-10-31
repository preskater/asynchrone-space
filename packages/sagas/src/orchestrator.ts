import type { SagaClient } from "@workspace/contracts"

export type SagaStatus =
  "pending" | "running" | "partial" | "completed" | "failed"
export type SagaAppStatus =
  "pending" | "running" | "completed" | "failed" | "skipped"

export interface SagaAppState {
  app: string
  status: SagaAppStatus
}

export interface SagaJobState {
  id: string
  status: string
  apps: SagaAppState[]
  deadlineAt?: Date | null
}

/**
 * Persistence port for the deletion sagas. The identity app implements it with
 * the `OrganizationDeletionJob` / `UserDeletionJob` tables.
 */
export interface DeletionSagaStore {
  ensureOrganizationJob(input: {
    organizationId: string
    apps: string[]
    requestedById?: string | null
  }): Promise<SagaJobState>
  markOrganizationApp(input: {
    jobId: string
    app: string
    status: SagaAppStatus
    error?: string | null
  }): Promise<void>
  markOrganizationJob(input: {
    jobId: string
    status: SagaStatus
    currentApp?: string | null
    error?: string | null
  }): Promise<void>
  /** Deletes the identity rows; always the last step. */
  deleteOrganizationIdentity(organizationId: string): Promise<void>

  ensureUserJob(input: {
    userId: string
    organizationId?: string | null
    apps: string[]
  }): Promise<SagaJobState>
  markUserApp(input: {
    jobId: string
    app: string
    status: SagaAppStatus
    error?: string | null
  }): Promise<void>
  markUserJob(input: {
    jobId: string
    status: SagaStatus
    currentApp?: string | null
    error?: string | null
  }): Promise<void>
  /** Deletes or anonymizes the identity account; always the last step. */
  deleteUserIdentity(userId: string): Promise<void>
}

export interface DeletionSagaResult {
  jobId: string
  status: SagaStatus
  apps: SagaAppState[]
  failedApps: string[]
}

export interface OrganizationDeletionOptions {
  organizationId: string
  apps: string[]
  clients: Record<string, Pick<SagaClient, "deleteOrganization">>
  store: DeletionSagaStore
  requestedById?: string | null
  now?: Date
}

export interface UserDeletionOptions {
  userId: string
  organizationId?: string | null
  apps: string[]
  clients: Record<string, Pick<SagaClient, "deleteUser">>
  store: DeletionSagaStore
  now?: Date
}

function sameApps(state: SagaAppState[], apps: string[]): SagaAppState[] {
  return apps.map(
    (app) =>
      state.find((candidate) => candidate.app === app) ?? {
        app,
        status: "pending",
      }
  )
}

/**
 * Delete one organization from every app, then identity.
 *
 * Each app is attempted independently and its result persisted, so a retry
 * skips the apps that already completed. A partial run never deletes identity:
 * the organization keeps its account and can be retried.
 */
export async function runOrganizationDeletionSaga(
  options: OrganizationDeletionOptions
): Promise<DeletionSagaResult> {
  const job = await options.store.ensureOrganizationJob({
    organizationId: options.organizationId,
    apps: options.apps,
    requestedById: options.requestedById,
  })
  if (job.status === "completed") {
    return {
      jobId: job.id,
      status: "completed",
      apps: sameApps(job.apps, options.apps),
      failedApps: [],
    }
  }

  const now = options.now ?? new Date()
  if (job.deadlineAt && job.deadlineAt < now) {
    await options.store.markOrganizationJob({
      jobId: job.id,
      status: "failed",
      error: "Deletion deadline exceeded",
    })
    return {
      jobId: job.id,
      status: "failed",
      apps: sameApps(job.apps, options.apps),
      failedApps: options.apps,
    }
  }

  const state = sameApps(job.apps, options.apps)
  await options.store.markOrganizationJob({
    jobId: job.id,
    status: "running",
  })

  for (const app of options.apps) {
    const current = state.find((candidate) => candidate.app === app)
    if (
      !current ||
      current.status === "completed" ||
      current.status === "skipped"
    ) {
      continue
    }
    await options.store.markOrganizationApp({
      jobId: job.id,
      app,
      status: "running",
    })
    try {
      const client = options.clients[app]
      if (!client) throw new Error(`No client for ${app}`)
      await client.deleteOrganization(options.organizationId)
      current.status = "completed"
      await options.store.markOrganizationApp({
        jobId: job.id,
        app,
        status: "completed",
      })
    } catch (cause) {
      current.status = "failed"
      await options.store.markOrganizationApp({
        jobId: job.id,
        app,
        status: "failed",
        error: cause instanceof Error ? cause.message : "App deletion failed",
      })
    }
  }

  const failedApps = state
    .filter((app) => app.status === "failed")
    .map((app) => app.app)
  if (failedApps.length === 0) {
    await options.store.deleteOrganizationIdentity(options.organizationId)
    await options.store.markOrganizationJob({
      jobId: job.id,
      status: "completed",
    })
    return { jobId: job.id, status: "completed", apps: state, failedApps: [] }
  }

  await options.store.markOrganizationJob({
    jobId: job.id,
    status: "partial",
    error: `Failed apps: ${failedApps.join(", ")}`,
  })
  return { jobId: job.id, status: "partial", apps: state, failedApps }
}

/** The account-deletion counterpart: anonymize domains, delete identity last. */
export async function runUserDeletionSaga(
  options: UserDeletionOptions
): Promise<DeletionSagaResult> {
  const job = await options.store.ensureUserJob({
    userId: options.userId,
    organizationId: options.organizationId,
    apps: options.apps,
  })
  if (job.status === "completed") {
    return {
      jobId: job.id,
      status: "completed",
      apps: sameApps(job.apps, options.apps),
      failedApps: [],
    }
  }

  const now = options.now ?? new Date()
  if (job.deadlineAt && job.deadlineAt < now) {
    await options.store.markUserJob({
      jobId: job.id,
      status: "failed",
      error: "Deletion deadline exceeded",
    })
    return {
      jobId: job.id,
      status: "failed",
      apps: sameApps(job.apps, options.apps),
      failedApps: options.apps,
    }
  }

  const state = sameApps(job.apps, options.apps)
  await options.store.markUserJob({ jobId: job.id, status: "running" })

  for (const app of options.apps) {
    const current = state.find((candidate) => candidate.app === app)
    if (
      !current ||
      current.status === "completed" ||
      current.status === "skipped"
    ) {
      continue
    }
    await options.store.markUserApp({ jobId: job.id, app, status: "running" })
    try {
      const client = options.clients[app]
      if (!client) throw new Error(`No client for ${app}`)
      await client.deleteUser(options.userId)
      current.status = "completed"
      await options.store.markUserApp({
        jobId: job.id,
        app,
        status: "completed",
      })
    } catch (cause) {
      current.status = "failed"
      await options.store.markUserApp({
        jobId: job.id,
        app,
        status: "failed",
        error: cause instanceof Error ? cause.message : "App deletion failed",
      })
    }
  }

  const failedApps = state
    .filter((app) => app.status === "failed")
    .map((app) => app.app)
  if (failedApps.length === 0) {
    await options.store.deleteUserIdentity(options.userId)
    await options.store.markUserJob({ jobId: job.id, status: "completed" })
    return { jobId: job.id, status: "completed", apps: state, failedApps: [] }
  }

  await options.store.markUserJob({
    jobId: job.id,
    status: "partial",
    error: `Failed apps: ${failedApps.join(", ")}`,
  })
  return { jobId: job.id, status: "partial", apps: state, failedApps }
}

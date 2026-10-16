export const REPOSITORY_PROVIDERS = ["github", "gitlab"] as const

export type RepositoryProvider = (typeof REPOSITORY_PROVIDERS)[number]

const PROVIDER_LABELS: Record<RepositoryProvider, string> = {
  github: "GitHub",
  gitlab: "GitLab",
}

/** Display name used in error messages and hints. */
export function repositoryProviderLabel(provider: RepositoryProvider) {
  return PROVIDER_LABELS[provider]
}

/**
 * A repository connection as exposed to the UI. The access token and the
 * webhook secret are never part of this view; the webhook URL is derived from
 * the deployment's `BETTER_AUTH_URL` so the UI can hand it to the provider.
 */
export interface RepositoryConnectionView {
  id: string
  projectId: string
  provider: RepositoryProvider
  owner: string
  repo: string
  repoUrl: string
  /** Self-managed GitLab or GitHub Enterprise instance; absent for the cloud. */
  baseUrl?: string
  webhookUrl: string
  webhookSecret: string
  createdById: string
  lastSyncedAt?: string
  createdAt: string
}

export interface ConnectRepositoryInput {
  projectId: string
  provider: RepositoryProvider
  owner: string
  repo: string
  baseUrl?: string
}

/** A personal access token a user saves in their profile. */
export interface SetUserRepositoryTokenInput {
  provider: RepositoryProvider
  token: string
}

/** Which providers the current user has a personal token for. */
export type UserRepositoryTokenStatus = Record<RepositoryProvider, boolean>

/**
 * Remote references captured when a task is reported to a connected
 * repository; merged into the task row on creation.
 */
export interface TaskExternalLink {
  externalIssueNumber: number
  externalIssueUrl: string
  externalUpdatedAt: Date | null
}

/** Result of a connect/sync run, surfaced to the user as a toast. */
export interface RepositorySyncSummary {
  issuesImported: number
  issuesUpdated: number
  tasksPushed: number
}

export interface ConnectRepositoryResult {
  connection: RepositoryConnectionView
  summary: RepositorySyncSummary
}

/** An issue as returned by the provider, normalized across GitHub/GitLab. */
export interface RemoteIssue {
  number: number
  title: string
  body: string
  state: "open" | "closed"
  url: string
  updatedAt: string
}

export interface RemoteRepository {
  owner: string
  repo: string
  url: string
  defaultBranch: string
}

export interface RemotePullRequest {
  number: number
  title: string
  body: string
  url: string
  state: "open" | "closed" | "merged"
  sourceBranch: string
  targetBranch: string
}

/** Normalized webhook event produced by a provider adapter. */
export type RepositoryWebhookEvent =
  | { kind: "ping" }
  | {
      kind: "issue"
      action: "opened" | "edited" | "closed" | "reopened" | "deleted"
      issue: RemoteIssue
    }
  | {
      kind: "pull_request"
      action:
        | "opened"
        | "reopened"
        | "edited"
        | "ready_for_review"
        | "closed"
        | "merged"
      pullRequest: RemotePullRequest
    }
  | { kind: "ignored"; reason: string }

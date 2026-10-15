export const REPOSITORY_PROVIDERS = ["github", "gitlab"] as const

export type RepositoryProvider = (typeof REPOSITORY_PROVIDERS)[number]

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
  accessToken: string
  baseUrl?: string
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

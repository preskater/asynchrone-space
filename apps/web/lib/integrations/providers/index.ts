import { createGitHubClient } from "./github"
import { createGitLabClient } from "./gitlab"
import type { ProviderClient, ProviderClientConfig } from "./types"

export function createProviderClient(
  config: ProviderClientConfig
): ProviderClient {
  return config.provider === "gitlab"
    ? createGitLabClient(config)
    : createGitHubClient(config)
}

export { RepositoryApiError } from "./types"
export type {
  CreatePullRequestInput,
  ProviderClient,
  ProviderClientConfig,
  RepositoryApi,
} from "./types"

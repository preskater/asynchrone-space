/**
 * Scopes a public API token can carry.
 *
 * A route requires exactly one scope. Write scopes do not imply read access:
 * a token that only needs to mutate can omit the matching read scope, and a
 * token that needs to look resources up carries both.
 */
export const PUBLIC_API_SCOPES = {
  projectsRead: "projects:read",
  projectsWrite: "projects:write",
  tasksRead: "tasks:read",
  tasksWrite: "tasks:write",
  /** The workspace member directory, used to resolve task assignees. */
  membersRead: "members:read",
  clientsRead: "clients:read",
  clientsWrite: "clients:write",
  employeesRead: "employees:read",
  filesRead: "files:read",
} as const

export type PublicApiScope =
  (typeof PUBLIC_API_SCOPES)[keyof typeof PUBLIC_API_SCOPES]

export const PUBLIC_API_SCOPE_VALUES: readonly PublicApiScope[] =
  Object.values(PUBLIC_API_SCOPES)

const PUBLIC_API_SCOPE_SET: ReadonlySet<string> = new Set(
  PUBLIC_API_SCOPE_VALUES
)

export function isPublicApiScope(value: string): value is PublicApiScope {
  return PUBLIC_API_SCOPE_SET.has(value)
}

export function hasPublicApiScope(
  scopes: readonly string[],
  required: PublicApiScope
): boolean {
  return scopes.includes(required)
}

/**
 * Task identifiers look like `ABC-1`, `ABC-2`, …. The prefix is inherited
 * from the project's first task so renames don't change existing identifiers;
 * a fresh project derives it from the project name. Identifiers are unique per
 * organization, so the number is picked among every task of the organization
 * sharing the prefix (two projects can derive the same initials).
 * Shared by the project service and the repository sync service so tasks
 * created from remote issues get the same identifiers as local ones.
 */
export function taskPrefix(name: string, projectIdentifiers: string[]) {
  const existingPrefix = projectIdentifiers[0]?.replace(/-\d+$/, "")
  const base =
    existingPrefix ||
    name
      .replace(/[^a-zA-Z ]/g, "")
      .split(" ")
      .map((word) => word && word[0])
      .join("")
      .toUpperCase()
      .slice(0, 3)
  return base || "TSK"
}

export function nextTaskIdentifier(prefix: string, identifiers: string[]) {
  const used = new Set<number>()
  for (const identifier of identifiers) {
    const match = identifier.match(new RegExp(`^${prefix}-(\\d+)$`))
    if (match) used.add(Number(match[1]))
  }
  let next = 1
  while (used.has(next)) next += 1
  return `${prefix}-${next}`
}

const MAX_IDENTIFIER_ATTEMPTS = 5

/**
 * Runs `create` with a freshly allocated identifier, allocating again when a
 * concurrent insert took it first (`@@unique([organizationId, identifier])`
 * is the task table's only unique constraint, so any P2002 means that).
 */
export async function createWithTaskIdentifier<T>(
  allocate: () => Promise<string>,
  create: (identifier: string) => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const identifier = await allocate()
    try {
      return await create(identifier)
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code
      if (code !== "P2002" || attempt >= MAX_IDENTIFIER_ATTEMPTS) throw error
    }
  }
}

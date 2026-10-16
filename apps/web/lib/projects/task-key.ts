/**
 * Task identifiers are generated per project (`ABC-1`, `ABC-2`, …). The
 * prefix is inherited from the project's first task so renames don't change
 * existing identifiers; a fresh project derives it from the project name.
 * Shared by the project service and the repository sync service so tasks
 * created from remote issues get the same identifiers as local ones.
 */
export function nextTaskIdentifier(name: string, identifiers: string[]) {
  const existingPrefix = identifiers[0]?.replace(/-\d+$/, "")
  const base =
    existingPrefix ||
    name
      .replace(/[^a-zA-Z ]/g, "")
      .split(" ")
      .map((word) => word && word[0])
      .join("")
      .toUpperCase()
      .slice(0, 3)
  const prefix = base || "TSK"
  const used = new Set<number>()
  for (const identifier of identifiers) {
    const match = identifier.match(new RegExp(`^${prefix}-(\\d+)$`))
    if (match) used.add(Number(match[1]))
  }
  let next = 1
  while (used.has(next)) next += 1
  return `${prefix}-${next}`
}

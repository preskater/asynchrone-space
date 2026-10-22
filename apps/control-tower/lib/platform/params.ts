export type SearchParams = Record<string, string | string[] | undefined>

export const PAGE_SIZE = 25

export function readString(params: SearchParams, key: string): string {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

export function readPage(params: SearchParams): number {
  const raw = readString(params, "page")
  const page = Number(raw)
  return Number.isInteger(page) && page > 0 ? page : 1
}

export function pageHref(
  basePath: string,
  page: number,
  query: Record<string, string>
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) search.set(key, value)
  }
  if (page > 1) search.set("page", String(page))
  const suffix = search.toString()
  return suffix ? `${basePath}?${suffix}` : basePath
}

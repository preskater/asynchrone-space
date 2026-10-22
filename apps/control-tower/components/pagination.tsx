import Link from "next/link"

import { Button } from "@workspace/ui/components/button"

import { pageHref } from "@/lib/platform/params"

export function Pagination({
  basePath,
  page,
  pageCount,
  query,
  total,
}: {
  basePath: string
  page: number
  pageCount: number
  query: Record<string, string>
  total: number
}) {
  const previous = pageHref(basePath, Math.max(1, page - 1), query)
  const next = pageHref(basePath, Math.min(pageCount, page + 1), query)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {total === 0
          ? "No results"
          : `Page ${page} of ${pageCount} · ${total} result${total === 1 ? "" : "s"}`}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={previous} />}
            >
              Previous
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          {page < pageCount ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={next} />}
            >
              Next
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}

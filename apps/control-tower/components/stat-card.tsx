import type { ReactNode } from "react"

import type { LucideIcon } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  className,
}: {
  label: string
  value: string
  hint?: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

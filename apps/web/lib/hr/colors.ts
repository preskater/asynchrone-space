import type { LeaveStatus, WorkLocation } from "./types"

/**
 * Styling for work-location states. Colours follow the shared chart tokens so
 * they stay legible in both light and dark themes:
 *
 *   office  -> chart-2 (green)
 *   remote  -> chart-3 (blue)
 *   leave   -> chart-4 (orange)
 */
export const LOCATION_CLASSES: Record<
  WorkLocation,
  { cell: string; chip: string; dot: string; text: string }
> = {
  office: {
    cell: "bg-[color:var(--chart-2)]/20 hover:bg-[color:var(--chart-2)]/30 text-foreground",
    chip: "bg-[color:var(--chart-2)]/15 text-foreground",
    dot: "bg-[color:var(--chart-2)]",
    text: "text-[color:var(--chart-2)]",
  },
  remote: {
    cell: "bg-[color:var(--chart-3)]/20 hover:bg-[color:var(--chart-3)]/30 text-foreground",
    chip: "bg-[color:var(--chart-3)]/15 text-foreground",
    dot: "bg-[color:var(--chart-3)]",
    text: "text-[color:var(--chart-3)]",
  },
}

export const LEAVE_CLASSES = {
  cell: "bg-[color:var(--chart-4)]/20 hover:bg-[color:var(--chart-4)]/30 text-foreground",
  chip: "bg-[color:var(--chart-4)]/15 text-foreground",
  dot: "bg-[color:var(--chart-4)]",
  text: "text-[color:var(--chart-4)]",
}

export const LEAVE_STATUS_VARIANT: Record<
  LeaveStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  approved: "default",
  pending: "secondary",
  rejected: "destructive",
  cancelled: "outline",
}

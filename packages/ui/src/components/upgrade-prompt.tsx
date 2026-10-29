import * as React from "react"
import { SparklesIcon } from "lucide-react"
import { cn } from "cn"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

/** Shown in place of a surface the organization's plan does not include. */
function UpgradePrompt({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode
  description: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Alert
      role="status"
      data-slot="upgrade-prompt"
      className={cn("gap-y-1", className)}
    >
      <SparklesIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {action ? <div className="col-start-2 mt-2">{action}</div> : null}
    </Alert>
  )
}

export { UpgradePrompt }

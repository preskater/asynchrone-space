"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { HistoryIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"

import { unwrapActionResult } from "@workspace/core/action"
import type { Page } from "@workspace/core/pagination"
import { useErrorTranslator } from "@workspace/i18n/errors"
import type {
  WebhookDeliveryStatus,
  WebhookDeliverySummary,
  WebhookSubscriptionSummary,
} from "@/lib/webhooks/types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import {
  listWebhookDeliveriesAction,
  replayWebhookDeliveryAction,
} from "@/actions/webhooks"

const PAGE_SIZE = 20

const STATUS_LABEL = {
  pending: "statusPending",
  succeeded: "statusSucceeded",
  failed: "statusFailed",
} as const

const STATUS_VARIANT = {
  pending: "outline",
  succeeded: "secondary",
  failed: "destructive",
} as const

type StatusFilter = "all" | WebhookDeliveryStatus

export function WebhookDeliveriesCard({
  subscriptions,
  initial,
}: {
  subscriptions: WebhookSubscriptionSummary[]
  initial: Page<WebhookDeliverySummary>
}) {
  const t = useTranslations("Api")
  const te = useErrorTranslator()
  const format = useFormatter()

  const [status, setStatus] = React.useState<StatusFilter>("all")
  const [subscriptionId, setSubscriptionId] = React.useState("all")
  const [items, setItems] = React.useState(initial.items)
  const [nextCursor, setNextCursor] = React.useState(initial.nextCursor)
  const [loading, setLoading] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [replaying, setReplaying] = React.useState<string | null>(null)

  async function fetchPage(input: {
    status: StatusFilter
    subscriptionId: string
    cursor?: string | null
  }) {
    return unwrapActionResult(
      await listWebhookDeliveriesAction({
        limit: PAGE_SIZE,
        cursor: input.cursor ?? null,
        subscriptionId:
          input.subscriptionId === "all" ? null : input.subscriptionId,
        status: input.status === "all" ? null : input.status,
      })
    )
  }

  async function reload(nextStatus: StatusFilter, nextSubscriptionId: string) {
    setLoading(true)
    try {
      const page = await fetchPage({
        status: nextStatus,
        subscriptionId: nextSubscriptionId,
      })
      setItems(page.items)
      setNextCursor(page.nextCursor)
    } catch (cause) {
      toast.error(te(cause, "internal"))
    }
    setLoading(false)
  }

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    try {
      const page = await fetchPage({
        status,
        subscriptionId,
        cursor: nextCursor,
      })
      setItems((current) => [...current, ...page.items])
      setNextCursor(page.nextCursor)
    } catch (cause) {
      toast.error(te(cause, "internal"))
    }
    setLoadingMore(false)
  }

  async function replay(id: string) {
    setReplaying(id)
    try {
      unwrapActionResult(await replayWebhookDeliveryAction(id))
      toast.success(t("deliveryReplayed"))
      await reload(status, subscriptionId)
    } catch (cause) {
      toast.error(te(cause, "internal"))
    }
    setReplaying(null)
  }

  const endpointOptions = [
    { value: "all", label: t("allEndpoints") },
    ...subscriptions.map((subscription) => ({
      value: subscription.id,
      label: subscription.url,
    })),
  ]

  const statusOptions = [
    { value: "all", label: t("allStatuses") },
    ...(Object.keys(STATUS_LABEL) as WebhookDeliveryStatus[]).map((value) => ({
      value,
      label: t(STATUS_LABEL[value]),
    })),
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2">
              <HistoryIcon className="size-4" />
              {t("deliveriesTitle")}
            </CardTitle>
            <CardDescription>{t("deliveriesDescription")}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={statusOptions}
              value={status}
              onValueChange={(value) => {
                if (!value) return
                const next = value as StatusFilter
                setStatus(next)
                void reload(next, subscriptionId)
              }}
            >
              <SelectTrigger aria-label={t("filterStatus")} className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Select
              items={endpointOptions}
              value={subscriptionId}
              onValueChange={(value) => {
                if (!value) return
                setSubscriptionId(value)
                void reload(status, value)
              }}
            >
              <SelectTrigger
                aria-label={t("filterSubscription")}
                className="w-56"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {endpointOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
            <HistoryIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">{t("noDeliveries")}</p>
            <p className="text-sm text-muted-foreground">
              {t("noDeliveriesDescription")}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("event")}</TableHead>
                  <TableHead>{t("endpoint")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("attempts")}</TableHead>
                  <TableHead>{t("httpStatus")}</TableHead>
                  <TableHead>{t("lastError")}</TableHead>
                  <TableHead>{t("nextRetry")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead className="text-end">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="whitespace-nowrap">
                      {t(`webhookEvents.${delivery.eventType}` as never)}
                    </TableCell>
                    <TableCell>
                      <span
                        className="block max-w-56 truncate"
                        title={delivery.url}
                      >
                        {delivery.url}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[delivery.status]}>
                        {t(STATUS_LABEL[delivery.status])}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {delivery.attempts}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {delivery.lastStatusCode ?? t("emptyValue")}
                    </TableCell>
                    <TableCell>
                      {delivery.lastError ? (
                        <span
                          className="block max-w-56 truncate text-destructive"
                          title={delivery.lastError}
                        >
                          {delivery.lastError}
                        </span>
                      ) : (
                        t("emptyValue")
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {delivery.status === "pending"
                        ? format.dateTime(new Date(delivery.nextAttemptAt), {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : t("emptyValue")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format.dateTime(new Date(delivery.createdAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-end">
                      {delivery.status === "failed" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={replaying === delivery.id}
                          onClick={() => replay(delivery.id)}
                        >
                          {replaying === delivery.id ? (
                            <Spinner />
                          ) : (
                            <RotateCcwIcon data-icon="inline-start" />
                          )}
                          {t("replay")}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-center border-t px-6 py-3">
              {loading ? (
                <Spinner />
              ) : nextCursor ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? <Spinner /> : null}
                  {loadingMore ? t("loadingMore") : t("loadMore")}
                </Button>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

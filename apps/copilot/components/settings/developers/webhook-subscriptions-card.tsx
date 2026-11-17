"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import {
  CheckIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  WebhookIcon,
} from "lucide-react"
import { toast } from "sonner"

import { WEBHOOK_EVENTS, type WebhookEvent } from "@workspace/contracts"
import { unwrapActionResult } from "@workspace/core/action"
import { useErrorTranslator } from "@workspace/i18n/errors"
import { useRouter } from "@workspace/i18n/navigation"
import type { WebhookSubscriptionSummary } from "@/lib/webhooks/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
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
  createWebhookSubscriptionAction,
  deleteWebhookSubscriptionAction,
  updateWebhookSubscriptionAction,
} from "@/actions/webhooks"

const EVENT_GROUPS = [
  { key: "projects", prefix: "project" },
  { key: "tasks", prefix: "task" },
  { key: "clients", prefix: "client" },
  { key: "contacts", prefix: "contact" },
  { key: "deals", prefix: "deal" },
  { key: "members", prefix: "member" },
] as const

function EndpointDialog({
  open,
  onOpenChange,
  subscription,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription: WebhookSubscriptionSummary | null
  onSaved: (secret?: string) => void
}) {
  const t = useTranslations("Api")
  const te = useErrorTranslator()
  const [url, setUrl] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [selected, setSelected] = React.useState<WebhookEvent[]>([])
  const [active, setActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setUrl(subscription?.url ?? "")
    setDescription(subscription?.description ?? "")
    setSelected(subscription?.events ?? [])
    setActive(subscription?.active ?? true)
    setError(null)
    setSaving(false)
  }, [open, subscription])

  function toggleEvent(event: WebhookEvent) {
    setSelected((current) =>
      current.includes(event)
        ? current.filter((value) => value !== event)
        : [...current, event]
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = url.trim()
    if (!trimmed) {
      setError(t("urlRequired"))
      return
    }
    if (selected.length === 0) {
      setError(t("eventsRequired"))
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (subscription) {
        unwrapActionResult(
          await updateWebhookSubscriptionAction({
            id: subscription.id,
            url: trimmed,
            description: description.trim() || null,
            events: selected,
            active,
          })
        )
        toast.success(t("webhookUpdated"))
        onSaved()
      } else {
        const created = unwrapActionResult(
          await createWebhookSubscriptionAction({
            url: trimmed,
            description: description.trim() || null,
            events: selected,
            active,
          })
        )
        toast.success(t("webhookCreated"))
        onSaved(created.secret)
      }
      onOpenChange(false)
    } catch (cause) {
      setError(te(cause, "internal"))
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {subscription ? t("editEndpoint") : t("addEndpoint")}
          </DialogTitle>
          <DialogDescription>
            {subscription
              ? t("editEndpointDescription")
              : t("createEndpointDescription")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="webhook-url">{t("endpointUrl")}</FieldLabel>
              <Input
                id="webhook-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t("endpointUrlPlaceholder")}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="webhook-description">
                {t("endpointDescription")}
              </FieldLabel>
              <Input
                id="webhook-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("endpointDescriptionPlaceholder")}
                maxLength={200}
              />
            </Field>
            <Field>
              <FieldLabel>{t("events")}</FieldLabel>
              <div className="flex flex-col gap-3">
                {EVENT_GROUPS.map((group) => {
                  const events = WEBHOOK_EVENTS.filter((event) =>
                    event.startsWith(`${group.prefix}.`)
                  )
                  return (
                    <div key={group.key}>
                      <p className="text-xs font-medium text-muted-foreground">
                        {t(`webhookGroups.${group.key}` as never)}
                      </p>
                      <div className="mt-1 grid gap-2 sm:grid-cols-2">
                        {events.map((event) => {
                          const id = `webhook-event-${event.replace(".", "-")}`
                          return (
                            <label
                              key={event}
                              htmlFor={id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Checkbox
                                id={id}
                                checked={selected.includes(event)}
                                onCheckedChange={() => toggleEvent(event)}
                              />
                              <span>
                                {t(`webhookEvents.${event}` as never)}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Field>
            <Field>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="webhook-active"
                  checked={active}
                  onCheckedChange={(checked) => setActive(checked)}
                />
                <FieldLabel htmlFor="webhook-active">{t("active")}</FieldLabel>
              </div>
            </Field>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t("cancel")}
            </DialogClose>
            <Button type="submit" disabled={saving}>
              {saving ? <Spinner /> : null}
              {saving ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function WebhookSubscriptionsCard({
  subscriptions,
}: {
  subscriptions: WebhookSubscriptionSummary[]
}) {
  const t = useTranslations("Api")
  const te = useErrorTranslator()
  const format = useFormatter()
  const router = useRouter()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editTarget, setEditTarget] =
    React.useState<WebhookSubscriptionSummary | null>(null)
  const [secret, setSecret] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [deleteTarget, setDeleteTarget] =
    React.useState<WebhookSubscriptionSummary | null>(null)
  const [deleting, setDeleting] = React.useState(false)

  async function copySecret() {
    if (!secret) return
    await navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      unwrapActionResult(await deleteWebhookSubscriptionAction(deleteTarget.id))
      setDeleteTarget(null)
      toast.success(t("webhookDeleted"))
      router.refresh()
    } catch (cause) {
      toast.error(te(cause, "internal"))
    }
    setDeleting(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <WebhookIcon className="size-4" />
                {t("webhooksTitle")}
              </CardTitle>
              <CardDescription>{t("webhooksDescription")}</CardDescription>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t("addEndpoint")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {subscriptions.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
              <WebhookIcon className="size-8 text-muted-foreground" />
              <p className="font-medium">{t("noWebhooks")}</p>
              <p className="text-sm text-muted-foreground">
                {t("noWebhooksDescription")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("endpointUrl")}</TableHead>
                  <TableHead>{t("events")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("createdAt")}</TableHead>
                  <TableHead className="text-end">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div className="flex max-w-xs flex-col gap-1">
                        <span className="font-medium break-all">
                          {subscription.url}
                        </span>
                        {subscription.description ? (
                          <span className="text-xs text-muted-foreground">
                            {subscription.description}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-sm flex-wrap gap-1">
                        {subscription.events.map((event) => (
                          <Badge key={event} variant="outline">
                            {t(`webhookEvents.${event}` as never)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={subscription.active ? "secondary" : "outline"}
                      >
                        {subscription.active ? t("active") : t("inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format.dateTime(new Date(subscription.createdAt), {
                        dateStyle: "medium",
                      })}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("editEndpoint")}
                          onClick={() => setEditTarget(subscription)}
                        >
                          <PencilIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("deleteEndpoint")}
                          onClick={() => setDeleteTarget(subscription)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EndpointDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        subscription={null}
        onSaved={(createdSecret) => {
          if (createdSecret) setSecret(createdSecret)
          router.refresh()
        }}
      />
      <EndpointDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        subscription={editTarget}
        onSaved={() => router.refresh()}
      />

      <Dialog
        open={secret !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSecret(null)
            setCopied(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("secretTitle")}</DialogTitle>
            <DialogDescription>{t("secretDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              value={secret ?? ""}
              readOnly
              className="font-mono text-xs"
              aria-label={t("secretTitle")}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copySecret}
              aria-label={t("copySecret")}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSecret(null)}>
              {t("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteEndpointTitle", { url: deleteTarget?.url ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteEndpointDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? <Spinner /> : null}
              {t("deleteEndpoint")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

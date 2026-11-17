"use client"

import * as React from "react"
import { useFormatter, useTranslations } from "next-intl"
import { CheckIcon, CopyIcon, KeyRoundIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import {
  PUBLIC_API_SCOPE_VALUES,
  type ApiTokenSummary,
} from "@workspace/contracts"
import { unwrapActionResult } from "@workspace/core/action"
import { useRouter } from "@workspace/i18n/navigation"
import { useErrorTranslator } from "@workspace/i18n/errors"
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
  createApiTokenAction,
  revokeApiTokenAction,
} from "@/actions/api-tokens"

const EXPIRY_OPTIONS = [
  { value: "never", labelKey: "expiryNever" },
  { value: "30", labelKey: "expiry30" },
  { value: "90", labelKey: "expiry90" },
  { value: "365", labelKey: "expiry365" },
] as const

type Expiry = (typeof EXPIRY_OPTIONS)[number]["value"]

const STATUS_LABEL = {
  active: "statusActive",
  expired: "statusExpired",
  revoked: "statusRevoked",
} as const

type TokenStatus = keyof typeof STATUS_LABEL

function statusOf(token: ApiTokenSummary): TokenStatus {
  if (token.revokedAt) return "revoked"
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) {
    return "expired"
  }
  return "active"
}

export function ApiTokensCard({ tokens }: { tokens: ApiTokenSummary[] }) {
  const t = useTranslations("Api")
  const te = useErrorTranslator()
  const format = useFormatter()
  const router = useRouter()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [selected, setSelected] = React.useState<string[]>([])
  const [expiry, setExpiry] = React.useState<Expiry>("never")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [createdToken, setCreatedToken] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const [revokeTarget, setRevokeTarget] =
    React.useState<ApiTokenSummary | null>(null)
  const [revoking, setRevoking] = React.useState(false)

  React.useEffect(() => {
    if (!createOpen) {
      setName("")
      setSelected([])
      setExpiry("never")
      setError(null)
      setSubmitting(false)
    }
  }, [createOpen])

  function toggleScope(scope: string) {
    setSelected((current) =>
      current.includes(scope)
        ? current.filter((value) => value !== scope)
        : [...current, scope]
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError(t("nameRequired"))
      return
    }
    if (selected.length === 0) {
      setError(t("scopesRequired"))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const data = unwrapActionResult(
        await createApiTokenAction({
          name: name.trim(),
          scopes: selected,
          expiresInDays: expiry === "never" ? null : Number(expiry),
        })
      )
      setCreatedToken(data.token)
      setCreateOpen(false)
      toast.success(t("toastCreated"))
      router.refresh()
    } catch (cause) {
      setError(te(cause, "internal"))
    }
    setSubmitting(false)
  }

  async function copyToken() {
    if (!createdToken) return
    await navigator.clipboard.writeText(createdToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function confirmRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      unwrapActionResult(await revokeApiTokenAction(revokeTarget.id))
      setRevokeTarget(null)
      toast.success(t("toastRevoked"))
      router.refresh()
    } catch (cause) {
      toast.error(te(cause, "internal"))
    }
    setRevoking(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2">
                <KeyRoundIcon className="size-4" />
                {t("tokensTitle")}
              </CardTitle>
              <CardDescription>{t("tokensDescription")}</CardDescription>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t("createToken")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {tokens.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
              <KeyRoundIcon className="size-8 text-muted-foreground" />
              <p className="font-medium">{t("empty")}</p>
              <p className="text-sm text-muted-foreground">
                {t("emptyDescription")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("prefix")}</TableHead>
                  <TableHead>{t("scopesLabel")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("lastUsed")}</TableHead>
                  <TableHead>{t("expiresAt")}</TableHead>
                  <TableHead className="text-end">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => {
                  const status = statusOf(token)
                  return (
                    <TableRow key={token.id}>
                      <TableCell className="font-medium">
                        {token.name}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">
                          {token.prefix}…
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {token.scopes.map((scope) => (
                            <Badge key={scope} variant="outline">
                              {t(`scopes.${scope}` as never)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "active" ? "secondary" : "outline"
                          }
                        >
                          {t(STATUS_LABEL[status])}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {token.lastUsedAt
                          ? format.dateTime(new Date(token.lastUsedAt), {
                              dateStyle: "medium",
                            })
                          : t("never")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {token.expiresAt
                          ? format.dateTime(new Date(token.expiresAt), {
                              dateStyle: "medium",
                            })
                          : t("never")}
                      </TableCell>
                      <TableCell className="text-end">
                        {status === "revoked" ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRevokeTarget(token)}
                          >
                            {t("revoke")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createTokenTitle")}</DialogTitle>
            <DialogDescription>{t("createTokenDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="token-name">{t("name")}</FieldLabel>
                <Input
                  id="token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("namePlaceholder")}
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel>{t("scopesLabel")}</FieldLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PUBLIC_API_SCOPE_VALUES.map((scope) => {
                    const id = `token-scope-${scope.replace(":", "-")}`
                    return (
                      <label
                        key={scope}
                        htmlFor={id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          id={id}
                          checked={selected.includes(scope)}
                          onCheckedChange={() => toggleScope(scope)}
                        />
                        <span>{t(`scopes.${scope}`)}</span>
                      </label>
                    )
                  })}
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="token-expiry">{t("expiry")}</FieldLabel>
                <Select
                  items={EXPIRY_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  value={expiry}
                  onValueChange={(value) => setExpiry(value as Expiry)}
                >
                  <SelectTrigger id="token-expiry" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {EXPIRY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {t("createTokenDescription")}
                </FieldDescription>
              </Field>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </FieldGroup>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                {t("cancel")}
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Spinner /> : null}
                {submitting ? t("creating") : t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createdToken !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedToken(null)
            setCopied(false)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("oneTimeTitle")}</DialogTitle>
            <DialogDescription>{t("oneTimeDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              value={createdToken ?? ""}
              readOnly
              className="font-mono text-xs"
              aria-label={t("oneTimeTitle")}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyToken}
              aria-label={t("copy")}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setCreatedToken(null)}>
              {t("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("revokeTitle", { name: revokeTarget?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revoking}
              onClick={confirmRevoke}
            >
              {revoking ? <Spinner /> : null}
              {t("revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

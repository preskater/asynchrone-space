"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  Field,
  FieldError,
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
import { Textarea } from "@workspace/ui/components/textarea"

import {
  createTimeOffRequestAction,
  setTimeOffAllowanceAction,
  updateHrSettingsAction,
} from "@/actions/hr"
import { useRouter } from "@/i18n/navigation"
import { unwrapActionResult } from "@/lib/core/action"
import { countBusinessDays } from "@/lib/hr/date-utils"
import {
  LEAVE_TYPES,
  type HrMember,
  type HrSettingsData,
  type LeaveType,
} from "@/lib/hr/types"
import { useErrorTranslator } from "@/lib/i18n/errors"
import { useEnumLabel } from "@/lib/i18n/labels"

import { HrDatePicker } from "./hr-date-picker"

export function TimeOffRequestDialog({
  trigger,
}: {
  trigger: React.ReactElement
}) {
  const t = useTranslations("Hr")
  const tV = useTranslations("Errors.validationMessages")
  const tT = useTranslations("Toasts")
  const te = useErrorTranslator()
  const L = useEnumLabel()
  const router = useRouter()

  const [open, setOpen] = React.useState(false)
  const [type, setType] = React.useState<LeaveType>("vacation")
  const [startDate, setStartDate] = React.useState("")
  const [endDate, setEndDate] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const days =
    startDate && endDate && endDate >= startDate
      ? countBusinessDays(startDate, endDate)
      : 0
  const startInvalid = submitted && !startDate
  const endMissing = submitted && !endDate
  const endBeforeStart = submitted && !!endDate && endDate < startDate
  const noWorkingDays =
    submitted && !startInvalid && !endMissing && !endBeforeStart && days <= 0

  const typeItems = LEAVE_TYPES.map((value) => ({
    value,
    label: L.leaveType(value),
  }))

  function reset() {
    setType("vacation")
    setStartDate("")
    setEndDate("")
    setReason("")
    setSubmitted(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!startDate || !endDate || endDate < startDate || days <= 0) return
    setSubmitting(true)
    try {
      unwrapActionResult(
        await createTimeOffRequestAction({
          type,
          startDate,
          endDate,
          reason: reason.trim() || undefined,
        })
      )
      toast.success(tT("timeOffRequested"))
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrRequestFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) reset()
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("timeOff.requestTitle")}</DialogTitle>
          <DialogDescription>
            {t("timeOff.requestDescription")}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="timeoff-type">
                {t("timeOff.type")}
              </FieldLabel>
              <Select
                items={typeItems}
                value={type}
                onValueChange={(value) => setType(value as LeaveType)}
              >
                <SelectTrigger id="timeoff-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {typeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={startInvalid}>
                <FieldLabel htmlFor="timeoff-start">
                  {t("timeOff.startDate")}
                </FieldLabel>
                <HrDatePicker
                  id="timeoff-start"
                  value={startDate || undefined}
                  onChange={setStartDate}
                  placeholder={t("timeOff.pickStart")}
                  invalid={startInvalid}
                />
                {startInvalid ? <FieldError>{tV("required")}</FieldError> : null}
              </Field>
              <Field data-invalid={endMissing || endBeforeStart || noWorkingDays}>
                <FieldLabel htmlFor="timeoff-end">
                  {t("timeOff.endDate")}
                </FieldLabel>
                <HrDatePicker
                  id="timeoff-end"
                  value={endDate || undefined}
                  onChange={setEndDate}
                  placeholder={t("timeOff.pickEnd")}
                  disabledBefore={startDate || undefined}
                  invalid={endMissing || endBeforeStart || noWorkingDays}
                />
                {endMissing ? <FieldError>{tV("required")}</FieldError> : null}
                {endBeforeStart ? (
                  <FieldError>{t("timeOff.endBeforeStart")}</FieldError>
                ) : null}
                {noWorkingDays ? (
                  <FieldError>{t("timeOff.noWorkingDays")}</FieldError>
                ) : null}
              </Field>
            </div>

            {days > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("timeOff.workingDays", { count: days })}
              </p>
            ) : null}

            <Field>
              <FieldLabel htmlFor="timeoff-reason">
                {t("timeOff.reason")}
              </FieldLabel>
              <Textarea
                id="timeoff-reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("timeOff.reasonPlaceholder")}
              />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t("timeOff.cancelRequest")}
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="size-4" /> : null}
              {t("timeOff.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AllowanceDialog({
  member,
  year,
  allowanceDays,
  trigger,
}: {
  member: HrMember
  year: number
  allowanceDays: number
  trigger: React.ReactElement
}) {
  const t = useTranslations("Hr")
  const tT = useTranslations("Toasts")
  const te = useErrorTranslator()
  const router = useRouter()

  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(String(allowanceDays))
  const [submitted, setSubmitted] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const parsed = Number(value)
  const invalid =
    !Number.isFinite(parsed) || parsed < 0 || parsed > 365 || value === ""

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (invalid) return
    setSubmitting(true)
    try {
      unwrapActionResult(
        await setTimeOffAllowanceAction({
          userId: member.id,
          year,
          allowanceDays: parsed,
        })
      )
      toast.success(tT("allowanceUpdated"))
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrAllowanceFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setValue(String(allowanceDays))
          setSubmitted(false)
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("timeOff.allowanceTitle", { name: member.name })}
          </DialogTitle>
          <DialogDescription>
            {t("timeOff.allowanceDescription")}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field data-invalid={submitted && invalid}>
            <FieldLabel htmlFor="allowance-days">
              {t("timeOff.allowanceLabel")}
            </FieldLabel>
            <Input
              id="allowance-days"
              type="number"
              min={0}
              max={365}
              step={0.5}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              aria-invalid={submitted && invalid}
            />
            {submitted && invalid ? (
              <FieldError>0 – 365</FieldError>
            ) : null}
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t("timeOff.cancelRequest")}
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="size-4" /> : null}
              {t("timeOff.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function HrSettingsDialog({
  settings,
  trigger,
}: {
  settings: HrSettingsData
  trigger: React.ReactElement
}) {
  const t = useTranslations("Hr")
  const tT = useTranslations("Toasts")
  const te = useErrorTranslator()
  const router = useRouter()

  const [open, setOpen] = React.useState(false)
  const [allowance, setAllowance] = React.useState(
    String(settings.defaultAllowanceDays)
  )
  const [weeklyTarget, setWeeklyTarget] = React.useState(
    String(settings.weeklyHourTarget)
  )
  const [submitted, setSubmitted] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const allowanceValue = Number(allowance)
  const targetValue = Number(weeklyTarget)
  const allowanceInvalid =
    allowance === "" ||
    !Number.isFinite(allowanceValue) ||
    allowanceValue < 0 ||
    allowanceValue > 365
  const targetInvalid =
    weeklyTarget === "" ||
    !Number.isFinite(targetValue) ||
    targetValue < 1 ||
    targetValue > 80

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (allowanceInvalid || targetInvalid) return
    setSubmitting(true)
    try {
      unwrapActionResult(
        await updateHrSettingsAction({
          defaultAllowanceDays: allowanceValue,
          weeklyHourTarget: targetValue,
        })
      )
      toast.success(tT("settingsUpdated"))
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrSettingsFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setAllowance(String(settings.defaultAllowanceDays))
          setWeeklyTarget(String(settings.weeklyHourTarget))
          setSubmitted(false)
        }
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("timeOff.settingsTitle")}</DialogTitle>
          <DialogDescription>
            {t("timeOff.settingsDescription")}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Field data-invalid={submitted && allowanceInvalid}>
            <FieldLabel htmlFor="hr-default-allowance">
              {t("timeOff.defaultAllowance")}
            </FieldLabel>
            <Input
              id="hr-default-allowance"
              type="number"
              min={0}
              max={365}
              step={0.5}
              value={allowance}
              onChange={(event) => setAllowance(event.target.value)}
              aria-invalid={submitted && allowanceInvalid}
            />
            {submitted && allowanceInvalid ? (
              <FieldError>0 – 365</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={submitted && targetInvalid}>
            <FieldLabel htmlFor="hr-weekly-target">
              {t("timeOff.weeklyTarget")}
            </FieldLabel>
            <Input
              id="hr-weekly-target"
              type="number"
              min={1}
              max={80}
              step={0.5}
              value={weeklyTarget}
              onChange={(event) => setWeeklyTarget(event.target.value)}
              aria-invalid={submitted && targetInvalid}
            />
            {submitted && targetInvalid ? (
              <FieldError>1 – 80</FieldError>
            ) : null}
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {t("timeOff.cancelRequest")}
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="size-4" /> : null}
              {t("timeOff.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

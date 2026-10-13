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
import { Spinner } from "@workspace/ui/components/spinner"

import { logTimeEntryAction } from "@/actions/hr"
import { useRouter } from "@/i18n/navigation"
import { unwrapActionResult } from "@/lib/core/action"
import { localDateKey } from "@/lib/hr/date-utils"
import type { TimeEntryData } from "@/lib/hr/types"
import { useErrorTranslator } from "@/lib/i18n/errors"

import { HrDatePicker } from "./hr-date-picker"

/**
 * Log (or edit) the hours worked on a day. One entry per day: saving again for
 * the same date replaces the previous value.
 */
export function LogHoursDialog({
  trigger,
  entry,
}: {
  trigger: React.ReactElement
  entry?: TimeEntryData
}) {
  const t = useTranslations("Hr")
  const tV = useTranslations("Errors.validationMessages")
  const tT = useTranslations("Toasts")
  const te = useErrorTranslator()
  const router = useRouter()

  const todayKey = React.useMemo(() => localDateKey(new Date()), [])

  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState("")
  const [hours, setHours] = React.useState("")
  const [note, setNote] = React.useState("")
  const [submitted, setSubmitted] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const hoursValue = Number(hours)
  const dateInvalid = submitted && !date
  const hoursInvalid =
    submitted &&
    (hours === "" ||
      !Number.isFinite(hoursValue) ||
      hoursValue < 0.25 ||
      hoursValue > 24)

  function reset() {
    setDate(entry?.date ?? todayKey)
    setHours(entry ? String(entry.hours) : "")
    setNote(entry?.note ?? "")
    setSubmitted(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!date || hours === "" || !Number.isFinite(hoursValue)) return
    if (hoursValue < 0.25 || hoursValue > 24) return
    setSubmitting(true)
    try {
      unwrapActionResult(
        await logTimeEntryAction({
          date,
          hours: hoursValue,
          note: note.trim() || undefined,
        })
      )
      toast.success(tT("hoursLogged"))
      setOpen(false)
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrHoursFailed"))
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {entry ? t("hours.dialogTitleEdit") : t("hours.dialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("hours.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={dateInvalid}>
              <FieldLabel htmlFor="hours-date">{t("hours.date")}</FieldLabel>
              <HrDatePicker
                id="hours-date"
                value={date || undefined}
                onChange={setDate}
                placeholder={t("hours.date")}
                disabledAfter={todayKey}
                disabled={Boolean(entry)}
                invalid={dateInvalid}
              />
              {dateInvalid ? <FieldError>{tV("required")}</FieldError> : null}
            </Field>
            <Field data-invalid={hoursInvalid}>
              <FieldLabel htmlFor="hours-value">
                {t("hours.hoursLabel")}
              </FieldLabel>
              <Input
                id="hours-value"
                type="number"
                min={0.25}
                max={24}
                step={0.25}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                aria-invalid={hoursInvalid}
                autoFocus
              />
              {hoursInvalid ? (
                <FieldError>{t("hours.hoursInvalid")}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="hours-note">{t("hours.note")}</FieldLabel>
              <Input
                id="hours-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("hours.notePlaceholder")}
              />
            </Field>
          </FieldGroup>
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

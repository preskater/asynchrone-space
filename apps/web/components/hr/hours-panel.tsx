"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  ClockIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

import { deleteTimeEntryAction } from "@/actions/hr"
import { useRouter } from "@/i18n/navigation"
import { unwrapActionResult } from "@/lib/core/action"
import {
  addDaysToKey,
  countBusinessDays,
  formatDateKey,
  round2,
  startOfWeekKey,
} from "@/lib/hr/date-utils"
import type { HrOverviewData, TimeEntryData } from "@/lib/hr/types"
import { formatHours, sumHours } from "@/lib/hr/utils"
import { useErrorTranslator } from "@/lib/i18n/errors"

import { LogHoursDialog } from "./log-hours-dialog"
import { useTodayKey } from "./use-hr"

const STRIP_DAYS = 14

export function HoursPanel({ data }: { data: HrOverviewData }) {
  const t = useTranslations("Hr")
  const tT = useTranslations("Toasts")
  const te = useErrorTranslator()
  const locale = useLocale()
  const router = useRouter()
  const todayKey = useTodayKey(data.todayKey)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const entryByDate = React.useMemo(
    () => new Map(data.entries.map((entry) => [entry.date, entry])),
    [data.entries]
  )

  const weekStart = startOfWeekKey(todayKey)
  const weekEnd = addDaysToKey(weekStart, 6)
  const todayHours = entryByDate.get(todayKey)?.hours ?? 0
  const weekHours = sumHours(
    data.entries.filter(
      (entry) => entry.date >= weekStart && entry.date <= weekEnd
    )
  )
  const monthStart = `${todayKey.slice(0, 7)}-01`
  const monthHours = sumHours(
    data.entries.filter(
      (entry) => entry.date >= monthStart && entry.date <= todayKey
    )
  )
  const businessDaysSoFar = countBusinessDays(monthStart, todayKey)
  const averagePerDay =
    businessDaysSoFar > 0 ? round2(monthHours / businessDaysSoFar) : 0

  const target = data.settings.weeklyHourTarget
  const weekPct =
    target > 0 ? Math.min(100, Math.round((weekHours / target) * 100)) : 0
  const difference = round2(Math.abs(weekHours - target))

  const stripDays = React.useMemo(
    () =>
      Array.from({ length: STRIP_DAYS }, (_, index) =>
        addDaysToKey(todayKey, index - (STRIP_DAYS - 1))
      ),
    [todayKey]
  )
  const maxStripHours = Math.max(
    8,
    ...stripDays.map((key) => entryByDate.get(key)?.hours ?? 0)
  )

  async function remove(entry: TimeEntryData) {
    setDeletingId(entry.id)
    try {
      unwrapActionResult(await deleteTimeEntryAction(entry.id))
      toast.success(tT("hoursDeleted"))
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrDeleteFailed"))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>{t("hours.today")}</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ClockIcon className="size-5 text-muted-foreground" />
              {formatHours(todayHours)} h
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.canTrack ? (
              <LogHoursDialog
                trigger={
                  <Button size="sm" variant="outline">
                    <PlusIcon data-icon="inline-start" />
                    {t("hours.log")}
                  </Button>
                }
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("hours.thisWeek")}</CardDescription>
            <CardTitle className="text-2xl">{formatHours(weekHours)} h</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Progress value={weekPct} />
            <p className="text-xs text-muted-foreground">
              {t("hours.ofTarget", { target: formatHours(target) })}
              {" · "}
              {weekHours >= target
                ? t("hours.overTarget", { hours: formatHours(difference) })
                : t("hours.underTarget", { hours: formatHours(difference) })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("hours.thisMonth")}</CardDescription>
            <CardTitle className="text-2xl">
              {formatHours(monthHours)} h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t("hours.avgPerDay", { hours: formatHours(averagePerDay) })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("hours.last14")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5">
            {stripDays.map((key) => {
              const hours = entryByDate.get(key)?.hours ?? 0
              const height = hours
                ? Math.max(6, Math.round((hours / maxStripHours) * 72))
                : 4
              return (
                <div
                  key={key}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${formatDateKey(key, locale, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })} — ${formatHours(hours)} h`}
                >
                  <div
                    className={cn(
                      "w-full rounded-sm",
                      hours ? "bg-primary/80" : "bg-muted",
                      key === todayKey && "bg-primary"
                    )}
                    style={{ height }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {Number(key.slice(8, 10))}
                  </span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {t("hours.recentEntries")}
            </CardTitle>
            {data.canTrack ? (
              <LogHoursDialog
                trigger={
                  <Button size="sm">
                    <PlusIcon data-icon="inline-start" />
                    {t("hours.log")}
                  </Button>
                }
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {data.entries.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {t("hours.noEntries")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hours.date")}</TableHead>
                  <TableHead>{t("hours.hoursWorked")}</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    {t("hours.note")}
                  </TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDateKey(entry.date, locale, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatHours(entry.hours)} h
                    </TableCell>
                    <TableCell className="hidden max-w-64 truncate text-sm text-muted-foreground sm:table-cell">
                      {entry.note ?? "—"}
                    </TableCell>
                    <TableCell>
                      {data.canTrack ? (
                        <div className="flex justify-end gap-1">
                          <LogHoursDialog
                            entry={entry}
                            trigger={
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={t("hours.edit")}
                                title={t("hours.edit")}
                              >
                                <PencilIcon />
                              </Button>
                            }
                          />
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label={t("hours.delete")}
                                  title={t("hours.delete")}
                                  disabled={deletingId !== null}
                                />
                              }
                            >
                              {deletingId === entry.id ? (
                                <Spinner className="size-4" />
                              ) : (
                                <Trash2Icon />
                              )}
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t("hours.deleteQuestion")}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("hours.deleteDescription", {
                                    hours: formatHours(entry.hours),
                                    date: formatDateKey(entry.date, locale),
                                  })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t("timeOff.cancelRequest")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() => void remove(entry)}
                                >
                                  {t("hours.delete")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

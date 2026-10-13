"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import {
  Building2Icon,
  ClockIcon,
  HomeIcon,
  PlaneIcon,
  UsersIcon,
} from "lucide-react"
import { toast } from "sonner"

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
import { cn } from "@workspace/ui/lib/utils"

import { setWorkLocationAction } from "@/actions/hr"
import { useRouter } from "@/i18n/navigation"
import { unwrapActionResult } from "@/lib/core/action"
import { LEAVE_CLASSES, LOCATION_CLASSES } from "@/lib/hr/colors"
import {
  addDaysToKey,
  round2,
  startOfWeekKey,
} from "@/lib/hr/date-utils"
import type { HrOverviewData, WorkLocation } from "@/lib/hr/types"
import {
  formatHours,
  isOnLeave,
  locationOnDate,
  sumHours,
} from "@/lib/hr/utils"
import { useErrorTranslator } from "@/lib/i18n/errors"
import { useEnumLabel } from "@/lib/i18n/labels"

import { useTodayKey } from "./use-hr"

export function HrSummaryCards({ data }: { data: HrOverviewData }) {
  const t = useTranslations("Hr")
  const tT = useTranslations("Toasts")
  const te = useErrorTranslator()
  const L = useEnumLabel()
  const router = useRouter()
  const todayKey = useTodayKey(data.todayKey)
  const [pending, setPending] = React.useState<string | null>(null)

  const myLocation = locationOnDate(data.locations, data.currentUserId, todayKey)
  const onLeaveToday = isOnLeave(data.teamLeave, data.currentUserId, todayKey)

  const weekStart = startOfWeekKey(todayKey)
  const weekEnd = addDaysToKey(weekStart, 6)
  const weekHours = sumHours(
    data.entries.filter(
      (entry) => entry.date >= weekStart && entry.date <= weekEnd
    )
  )
  const monthHours = sumHours(
    data.entries.filter((entry) => entry.date.startsWith(todayKey.slice(0, 7)))
  )
  const target = data.settings.weeklyHourTarget
  const weekPct =
    target > 0 ? Math.min(100, Math.round((weekHours / target) * 100)) : 0
  const difference = round2(Math.abs(weekHours - target))

  const teamCounts = { office: 0, remote: 0, leave: 0, notSet: 0 }
  for (const member of data.members) {
    if (isOnLeave(data.teamLeave, member.id, todayKey)) {
      teamCounts.leave += 1
      continue
    }
    const status = locationOnDate(data.locations, member.id, todayKey)?.status
    if (status) teamCounts[status] += 1
    else teamCounts.notSet += 1
  }

  async function setStatus(status: WorkLocation | null) {
    setPending(status ?? "clear")
    try {
      unwrapActionResult(await setWorkLocationAction({ date: todayKey, status }))
      toast.success(status ? tT("statusSet") : tT("statusCleared"))
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrStatusFailed"))
    } finally {
      setPending(null)
    }
  }

  const statusLabel = onLeaveToday
    ? t("cards.statusLeave")
    : myLocation
      ? L.workLocation(myLocation.status)
      : t("cards.statusNotSet")
  const statusIcon = onLeaveToday ? (
    <PlaneIcon />
  ) : myLocation?.status === "office" ? (
    <Building2Icon />
  ) : myLocation?.status === "remote" ? (
    <HomeIcon />
  ) : null
  const statusClass = onLeaveToday
    ? LEAVE_CLASSES.text
    : myLocation
      ? LOCATION_CLASSES[myLocation.status].text
      : "text-muted-foreground"

  const balancePct =
    data.balance.allowanceDays > 0
      ? Math.min(
          100,
          Math.round((data.balance.usedDays / data.balance.allowanceDays) * 100)
        )
      : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>{t("cards.statusTitle")}</CardDescription>
          <CardTitle className={cn("flex items-center gap-2 text-2xl", statusClass)}>
            {statusIcon ? (
              <span className="[&_svg]:size-5">{statusIcon}</span>
            ) : null}
            {statusLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.canTrack ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={myLocation?.status === "office" ? "default" : "outline"}
                disabled={pending !== null}
                onClick={() => void setStatus("office")}
              >
                {pending === "office" ? (
                  <Spinner className="size-4" />
                ) : (
                  <Building2Icon data-icon="inline-start" />
                )}
                {L.workLocation("office")}
              </Button>
              <Button
                size="sm"
                variant={myLocation?.status === "remote" ? "default" : "outline"}
                disabled={pending !== null}
                onClick={() => void setStatus("remote")}
              >
                {pending === "remote" ? (
                  <Spinner className="size-4" />
                ) : (
                  <HomeIcon data-icon="inline-start" />
                )}
                {L.workLocation("remote")}
              </Button>
              {myLocation ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending !== null}
                  onClick={() => void setStatus(null)}
                >
                  {t("cards.clear")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>{t("cards.daysOffTitle")}</CardDescription>
          <CardTitle className="text-2xl">
            {data.balance.availableDays}
            <span className="ms-2 text-sm font-normal text-muted-foreground">
              {t("cards.daysUnit")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Progress value={balancePct} />
          <p className="text-xs text-muted-foreground">
            {t("cards.daysOffDetail", {
              allowance: data.balance.allowanceDays,
              used: data.balance.usedDays,
              pending: data.balance.pendingDays,
            })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>{t("cards.hoursTitle")}</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ClockIcon className="size-5 text-muted-foreground" />
            {formatHours(weekHours)} h
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Progress value={weekPct} />
          <p className="text-xs text-muted-foreground">
            {weekHours >= target
              ? t("cards.hoursOver", { hours: formatHours(difference) })
              : t("cards.hoursToTarget", { hours: formatHours(difference) })}
            {" · "}
            {t("cards.hoursMonth", { hours: formatHours(monthHours) })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>{t("cards.teamTitle")}</CardDescription>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <UsersIcon className="size-5 text-muted-foreground" />
            {t("cards.teamMembers", { count: data.members.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          <span className="flex items-center gap-2">
            <span
              className={cn("size-2 rounded-full", LOCATION_CLASSES.office.dot)}
            />
            {t("cards.teamOffice", { count: teamCounts.office })}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cn("size-2 rounded-full", LOCATION_CLASSES.remote.dot)}
            />
            {t("cards.teamRemote", { count: teamCounts.remote })}
          </span>
          <span className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", LEAVE_CLASSES.dot)} />
            {t("cards.teamLeave", { count: teamCounts.leave })}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground/40" />
            {t("cards.teamNotSet", { count: teamCounts.notSet })}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

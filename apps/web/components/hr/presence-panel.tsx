"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  Building2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  PlaneIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group"
import { cn } from "@workspace/ui/lib/utils"

import { fetchWorkLocationsAction, setWorkLocationAction } from "@/actions/hr"
import { useRouter } from "@/i18n/navigation"
import { buildMonthGrid } from "@/lib/calendars/date-utils"
import { unwrapActionResult } from "@/lib/core/action"
import { LEAVE_CLASSES, LOCATION_CLASSES } from "@/lib/hr/colors"
import {
  addMonthsToKey,
  countBusinessDays,
  formatDateKey,
  isWeekendKey,
  localDateFromKey,
  localDateKey,
  monthDateRange,
  monthKeyOf,
} from "@/lib/hr/date-utils"
import type {
  HrOverviewData,
  WorkLocation,
  WorkLocationDayData,
} from "@/lib/hr/types"
import { isOnLeave, locationOnDate } from "@/lib/hr/utils"
import { useErrorTranslator } from "@/lib/i18n/errors"
import { useEnumLabel } from "@/lib/i18n/labels"
import { getInitials } from "@/lib/organization/utils"

import { useTodayKey } from "./use-hr"

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

function groupDaysByMonth(days: WorkLocationDayData[], months: string[]) {
  const grouped: Record<string, WorkLocationDayData[]> = {}
  for (const month of months) grouped[month] = []
  for (const day of days) {
    const key = day.date.slice(0, 7)
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(day)
  }
  return grouped
}

function statusRank(leave: boolean, status?: WorkLocation) {
  if (leave) return 2
  if (status === "office") return 0
  if (status === "remote") return 1
  return 3
}

export function PresencePanel({ data }: { data: HrOverviewData }) {
  const t = useTranslations("Hr")
  const tT = useTranslations("Toasts")
  const te = useErrorTranslator()
  const L = useEnumLabel()
  const locale = useLocale()
  const router = useRouter()
  const todayKey = useTodayKey(data.todayKey)

  const [monthKey, setMonthKey] = React.useState(() =>
    monthKeyOf(data.todayKey)
  )
  const [selectedDate, setSelectedDate] = React.useState(() => data.todayKey)
  const [extraMonths, setExtraMonths] = React.useState<
    Record<string, WorkLocationDayData[]>
  >({})
  // Optimistic updates until the refreshed server data arrives.
  const [overrides, setOverrides] = React.useState<
    Record<string, WorkLocationDayData | "cleared">
  >({})
  const [loadingMonth, setLoadingMonth] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const requestIdRef = React.useRef(0)

  const serverMonths = React.useMemo(
    () => groupDaysByMonth(data.locations, data.locationMonths),
    [data.locations, data.locationMonths]
  )

  const hasMonth =
    serverMonths[monthKey] !== undefined || extraMonths[monthKey] !== undefined
  const monthDays = React.useMemo(() => {
    const base = extraMonths[monthKey] ?? serverMonths[monthKey] ?? []
    if (Object.keys(overrides).length === 0) return base
    const next = base.filter(
      (day) => !(`${day.userId}:${day.date}` in overrides)
    )
    for (const value of Object.values(overrides)) {
      if (value !== "cleared" && value.date.startsWith(monthKey)) {
        next.push(value)
      }
    }
    return next
  }, [extraMonths, monthKey, overrides, serverMonths])

  // Once refreshed server data lands, optimistic overrides are stale.
  React.useEffect(() => {
    setOverrides({})
  }, [data.locations])

  // Fetch months outside the preloaded window (previous/current/next month).
  React.useEffect(() => {
    if (hasMonth) {
      setLoadingMonth(false)
      return
    }
    const requestId = ++requestIdRef.current
    setLoadingMonth(true)
    fetchWorkLocationsAction(monthKey)
      .then((result) => {
        const value = unwrapActionResult(result)
        setExtraMonths((prev) => ({ ...prev, [value.month]: value.days }))
      })
      .catch((error) => toast.error(te(error, "hrLoadFailed")))
      .finally(() => {
        if (requestIdRef.current === requestId) setLoadingMonth(false)
      })
  }, [hasMonth, monthKey, te])

  const weeks = React.useMemo(
    () => buildMonthGrid(localDateFromKey(`${monthKey}-01`)),
    [monthKey]
  )

  const myLocation = locationOnDate(monthDays, data.currentUserId, selectedDate)
  const myOnLeave = isOnLeave(data.teamLeave, data.currentUserId, selectedDate)

  const myMonthDays = monthDays.filter(
    (day) => day.userId === data.currentUserId
  )
  const officeCount = myMonthDays.filter((day) => day.status === "office").length
  const remoteCount = myMonthDays.filter((day) => day.status === "remote").length
  const { start, end } = monthDateRange(monthKey)
  const businessDays = countBusinessDays(start, end)

  const dayRows = data.members
    .map((member) => ({
      member,
      leave: isOnLeave(data.teamLeave, member.id, selectedDate),
      status: locationOnDate(monthDays, member.id, selectedDate)?.status,
    }))
    .sort(
      (a, b) =>
        statusRank(a.leave, a.status) - statusRank(b.leave, b.status) ||
        a.member.name.localeCompare(b.member.name)
    )

  async function setStatus(status: WorkLocation | null) {
    const date = selectedDate
    setSaving(true)
    try {
      const result = unwrapActionResult(
        await setWorkLocationAction({ date, status })
      )
      setOverrides((prev) => ({
        ...prev,
        [`${data.currentUserId}:${date}`]: result ?? "cleared",
      }))
      toast.success(status ? tT("statusSet") : tT("statusCleared"))
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrStatusFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle>{t("presence.title")}</CardTitle>
              <CardDescription>{t("presence.description")}</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={t("presence.previousMonth")}
                onClick={() => setMonthKey(addMonthsToKey(monthKey, -1))}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="min-w-36 text-center text-sm font-medium">
                {formatDateKey(`${monthKey}-01`, locale, {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={t("presence.nextMonth")}
                onClick={() => setMonthKey(addMonthsToKey(monthKey, 1))}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loadingMonth && !hasMonth ? (
            <div className="flex h-72 flex-col items-center justify-center gap-2">
              <Spinner />
              <span className="text-sm text-muted-foreground">
                {t("presence.loading")}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_KEYS.map((key) => (
                <div
                  key={key}
                  className="py-1 text-center text-xs text-muted-foreground"
                >
                  {t(`presence.weekdays.${key}`)}
                </div>
              ))}
              {weeks.flat().map((day) => {
                const key = localDateKey(day)
                const inMonth = key.startsWith(monthKey)
                const isSelected = key === selectedDate
                const isToday = key === todayKey
                const weekend = isWeekendKey(key)
                const location = locationOnDate(
                  monthDays,
                  data.currentUserId,
                  key
                )
                const leave = isOnLeave(
                  data.teamLeave,
                  data.currentUserId,
                  key
                )
                const title = leave
                  ? t("cards.statusLeave")
                  : location
                    ? L.workLocation(location.status)
                    : t("presence.notSet")
                return (
                  <button
                    key={key}
                    type="button"
                    title={title}
                    onClick={() => setSelectedDate(key)}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-md border border-transparent text-sm transition-colors",
                      !inMonth && "opacity-40",
                      !location &&
                        !leave &&
                        (weekend || !inMonth
                          ? "bg-muted/40 text-muted-foreground hover:bg-muted"
                          : "hover:bg-muted"),
                      leave
                        ? LEAVE_CLASSES.cell
                        : location
                          ? LOCATION_CLASSES[location.status].cell
                          : null,
                      isSelected && "ring-2 ring-ring",
                      isToday && !isSelected && "border-primary/50 font-semibold"
                    )}
                  >
                    {Number(key.slice(8, 10))}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className={cn("size-2 rounded-full", LOCATION_CLASSES.office.dot)}
              />
              {L.workLocation("office")}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={cn("size-2 rounded-full", LOCATION_CLASSES.remote.dot)}
              />
              {L.workLocation("remote")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", LEAVE_CLASSES.dot)} />
              {t("cards.statusLeave")}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="font-medium text-[color:var(--chart-2)]">
                {t("presence.officeDays", { count: officeCount })}
              </p>
            </div>
            <div>
              <p className="font-medium text-[color:var(--chart-3)]">
                {t("presence.remoteDays", { count: remoteCount })}
              </p>
            </div>
            <div className="text-end text-muted-foreground">
              {t("presence.businessDays", { count: businessDays })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-base">{t("presence.dayDetails")}</CardTitle>
          <CardDescription>
            {formatDateKey(selectedDate, locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {t("presence.myLocation")}
            </p>
            {data.canTrack ? (
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  value={myLocation ? [myLocation.status] : []}
                  onValueChange={(value) => {
                    const next = value[0] as WorkLocation | undefined
                    if (!next || next === myLocation?.status) return
                    void setStatus(next)
                  }}
                  disabled={saving}
                  spacing={2}
                >
                  <ToggleGroupItem
                    value="office"
                    variant="outline"
                    aria-label={L.workLocation("office")}
                  >
                    <Building2Icon data-icon="inline-start" />
                    {L.workLocation("office")}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="remote"
                    variant="outline"
                    aria-label={L.workLocation("remote")}
                  >
                    <HomeIcon data-icon="inline-start" />
                    {L.workLocation("remote")}
                  </ToggleGroupItem>
                </ToggleGroup>
                {myLocation ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => void setStatus(null)}
                  >
                    {t("cards.clear")}
                  </Button>
                ) : null}
              </div>
            ) : (
              <Badge variant="outline" className="w-fit">
                {myLocation
                  ? L.workLocation(myLocation.status)
                  : t("presence.notSet")}
              </Badge>
            )}
            {myOnLeave ? (
              <Badge
                variant="outline"
                className={cn("w-fit gap-1.5", LEAVE_CLASSES.chip)}
              >
                <PlaneIcon className="size-3" />
                {t("cards.statusLeave")}
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              {t("presence.team")}
            </p>
            <div className="flex flex-col gap-2">
              {dayRows.map(({ member, leave, status }) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="size-7">
                      {member.avatarUrl ? (
                        <AvatarImage src={member.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm">
                      {member.name}
                      {member.id === data.currentUserId ? (
                        <span className="ms-1 text-muted-foreground">
                          {t("presence.you")}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  {leave ? (
                    <Badge
                      variant="outline"
                      className={cn("shrink-0 gap-1.5", LEAVE_CLASSES.chip)}
                    >
                      <PlaneIcon className="size-3" />
                      {t("cards.statusLeave")}
                    </Badge>
                  ) : status ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 gap-1.5",
                        LOCATION_CLASSES[status].chip
                      )}
                    >
                      {status === "office" ? (
                        <Building2Icon className="size-3" />
                      ) : (
                        <HomeIcon className="size-3" />
                      )}
                      {L.workLocation(status)}
                    </Badge>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {t("presence.notSet")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

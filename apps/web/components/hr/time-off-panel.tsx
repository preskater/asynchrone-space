"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  CalendarPlusIcon,
  CheckIcon,
  PencilIcon,
  Settings2Icon,
  XIcon,
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

import {
  cancelTimeOffRequestAction,
  decideTimeOffRequestAction,
} from "@/actions/hr"
import { useRouter } from "@/i18n/navigation"
import { unwrapActionResult } from "@/lib/core/action"
import { LEAVE_STATUS_VARIANT } from "@/lib/hr/colors"
import { formatDateKey } from "@/lib/hr/date-utils"
import type {
  HrOverviewData,
  LeaveStatus,
  TimeOffRequestData,
} from "@/lib/hr/types"
import { useErrorTranslator } from "@/lib/i18n/errors"
import { useEnumLabel } from "@/lib/i18n/labels"
import { getInitials } from "@/lib/organization/utils"

import {
  AllowanceDialog,
  HrSettingsDialog,
  TimeOffRequestDialog,
} from "./time-off-dialogs"

function MemberCell({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-[10px]">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium">{name}</span>
    </div>
  )
}

function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const L = useEnumLabel()
  return (
    <Badge variant={LEAVE_STATUS_VARIANT[status]}>
      {L.leaveStatus(status)}
    </Badge>
  )
}

export function TimeOffPanel({ data }: { data: HrOverviewData }) {
  const t = useTranslations("Hr")
  const tT = useTranslations("Toasts")
  const te = useErrorTranslator()
  const L = useEnumLabel()
  const locale = useLocale()
  const router = useRouter()

  const [cancellingId, setCancellingId] = React.useState<string | null>(null)
  const [decidingId, setDecidingId] = React.useState<string | null>(null)

  const memberById = React.useMemo(
    () => new Map(data.members.map((member) => [member.id, member])),
    [data.members]
  )

  const balancePct =
    data.balance.allowanceDays > 0
      ? Math.min(
          100,
          Math.round((data.balance.usedDays / data.balance.allowanceDays) * 100)
        )
      : 0

  const pendingRequests =
    data.allRequests?.filter((request) => request.status === "pending") ?? []

  function formatRange(request: TimeOffRequestData) {
    return `${formatDateKey(request.startDate, locale)} – ${formatDateKey(
      request.endDate,
      locale
    )}`
  }

  async function cancel(request: TimeOffRequestData) {
    setCancellingId(request.id)
    try {
      unwrapActionResult(await cancelTimeOffRequestAction(request.id))
      toast.success(tT("timeOffCancelled"))
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrCancelFailed"))
    } finally {
      setCancellingId(null)
    }
  }

  async function decide(
    request: TimeOffRequestData,
    decision: "approved" | "rejected"
  ) {
    setDecidingId(request.id)
    try {
      unwrapActionResult(
        await decideTimeOffRequestAction(request.id, { decision })
      )
      toast.success(
        decision === "approved" ? tT("timeOffApproved") : tT("timeOffDeclined")
      )
      router.refresh()
    } catch (error) {
      toast.error(te(error, "hrDecideFailed"))
    } finally {
      setDecidingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="self-start">
          <CardHeader>
            <CardDescription>{t("timeOff.balanceTitle")}</CardDescription>
            <CardTitle className="flex items-baseline gap-2 text-3xl">
              {data.balance.availableDays}
              <span className="text-sm font-normal text-muted-foreground">
                {t("timeOff.available")}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Progress value={balancePct} />
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {t("timeOff.allocated")}:{" "}
                <span className="font-medium text-foreground">
                  {data.balance.allowanceDays}
                </span>
              </span>
              <span>
                {t("timeOff.used")}:{" "}
                <span className="font-medium text-foreground">
                  {data.balance.usedDays}
                </span>
              </span>
              <span>
                {t("timeOff.pending")}:{" "}
                <span className="font-medium text-foreground">
                  {data.balance.pendingDays}
                </span>
              </span>
            </div>
            {data.canTrack ? (
              <TimeOffRequestDialog
                trigger={
                  <Button className="w-full">
                    <CalendarPlusIcon data-icon="inline-start" />
                    {t("timeOff.request")}
                  </Button>
                }
              />
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t("timeOff.myRequests")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {data.myRequests.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                {t("timeOff.noRequests")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("timeOff.type")}</TableHead>
                    <TableHead>{t("timeOff.dates")}</TableHead>
                    <TableHead>{t("timeOff.days")}</TableHead>
                    <TableHead>{t("timeOff.status")}</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.myRequests.map((request) => {
                    const cancellable =
                      data.canTrack &&
                      (request.status === "pending" ||
                        request.status === "approved")
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="text-sm">
                          {L.leaveType(request.type)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatRange(request)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {request.days}
                        </TableCell>
                        <TableCell>
                          <LeaveStatusBadge status={request.status} />
                        </TableCell>
                        <TableCell>
                          {cancellable ? (
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={t("timeOff.cancelRequest")}
                              title={t("timeOff.cancelRequest")}
                              disabled={cancellingId !== null}
                              onClick={() => void cancel(request)}
                            >
                              {cancellingId === request.id ? (
                                <Spinner className="size-4" />
                              ) : (
                                <XIcon />
                              )}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {data.canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("timeOff.approvals")}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {pendingRequests.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                {t("timeOff.noApprovals")}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("timeOff.member")}</TableHead>
                    <TableHead>{t("timeOff.type")}</TableHead>
                    <TableHead>{t("timeOff.dates")}</TableHead>
                    <TableHead>{t("timeOff.days")}</TableHead>
                    <TableHead>{t("timeOff.reason")}</TableHead>
                    <TableHead className="w-48 text-end" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((request) => {
                    const member = memberById.get(request.userId)
                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <MemberCell
                            name={request.userName}
                            avatarUrl={member?.avatarUrl}
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {L.leaveType(request.type)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatRange(request)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {request.days}
                        </TableCell>
                        <TableCell
                          className="max-w-48 truncate text-sm text-muted-foreground"
                          title={request.reason}
                        >
                          {request.reason ?? "—"}
                        </TableCell>
                        <TableCell className="text-end whitespace-nowrap">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              disabled={decidingId !== null}
                              onClick={() => void decide(request, "approved")}
                            >
                              {decidingId === request.id ? (
                                <Spinner className="size-4" />
                              ) : (
                                <CheckIcon data-icon="inline-start" />
                              )}
                              {t("timeOff.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={decidingId !== null}
                              onClick={() => void decide(request, "rejected")}
                            >
                              <XIcon data-icon="inline-start" />
                              {t("timeOff.decline")}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {data.canManage && data.teamBalances ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                {t("timeOff.teamBalances")}
              </CardTitle>
              <HrSettingsDialog
                settings={data.settings}
                trigger={
                  <Button size="sm" variant="outline">
                    <Settings2Icon data-icon="inline-start" />
                    {t("timeOff.settings")}
                  </Button>
                }
              />
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("timeOff.member")}</TableHead>
                  <TableHead>{t("timeOff.allowance")}</TableHead>
                  <TableHead>{t("timeOff.used")}</TableHead>
                  <TableHead>{t("timeOff.pending")}</TableHead>
                  <TableHead className="text-end">
                    {t("timeOff.available")}
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.teamBalances.map((balance) => {
                  const member = memberById.get(balance.userId)
                  return (
                    <TableRow key={balance.userId}>
                      <TableCell>
                        <MemberCell
                          name={balance.userName}
                          avatarUrl={member?.avatarUrl}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {balance.allowanceDays}
                        {!balance.configured ? (
                          <span className="ms-1 text-xs text-muted-foreground">
                            ({t("timeOff.defaultAllowance")})
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {balance.usedDays}
                      </TableCell>
                      <TableCell className="text-sm">
                        {balance.pendingDays}
                      </TableCell>
                      <TableCell className="text-end text-sm font-medium">
                        {balance.availableDays}
                      </TableCell>
                      <TableCell>
                        {member ? (
                          <AllowanceDialog
                            member={member}
                            year={data.year}
                            allowanceDays={balance.allowanceDays}
                            trigger={
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label={t("timeOff.editAllowance")}
                                title={t("timeOff.editAllowance")}
                              >
                                <PencilIcon />
                              </Button>
                            }
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

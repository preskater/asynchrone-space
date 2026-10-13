"use client"

import * as React from "react"
import {
  BarChart3Icon,
  CalendarDaysIcon,
  GaugeIcon,
  PalmtreeIcon,
  Settings2Icon,
  SunIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import type { HrOverviewData } from "@/lib/hr/types"

import { AdminPanel } from "./admin-panel"
import { CapacityPanel } from "./capacity-panel"
import { LeavePanel } from "./leave-panel"
import { TeamCalendar } from "./team-calendar"
import { TodayPanel } from "./today-panel"
import { TrackingPanel } from "./tracking-panel"

export function HrWorkspace({ data }: { data: HrOverviewData }) {
  const t = useTranslations("Hr")
  const [tab, setTab] = React.useState("today")

  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      className="flex flex-col gap-4"
    >
      <TabsList variant="line" className="w-full justify-start border-b pb-0">
        <TabsTrigger value="today">
          <SunIcon data-icon="inline-start" />
          {t("tabs.today")}
        </TabsTrigger>
        <TabsTrigger value="calendar">
          <CalendarDaysIcon data-icon="inline-start" />
          {t("tabs.calendar")}
        </TabsTrigger>
        <TabsTrigger value="leave">
          <PalmtreeIcon data-icon="inline-start" />
          {t("tabs.leave")}
        </TabsTrigger>
        <TabsTrigger value="tracking">
          <BarChart3Icon data-icon="inline-start" />
          {t("tabs.tracking")}
        </TabsTrigger>
        <TabsTrigger value="capacity">
          <GaugeIcon data-icon="inline-start" />
          {t("tabs.capacity")}
        </TabsTrigger>
        <TabsTrigger value="admin">
          <Settings2Icon data-icon="inline-start" />
          {t("tabs.admin")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="today">
        <TodayPanel data={data} onNavigate={setTab} />
      </TabsContent>
      <TabsContent value="calendar">
        <TeamCalendar data={data} />
      </TabsContent>
      <TabsContent value="leave">
        <LeavePanel data={data} />
      </TabsContent>
      <TabsContent value="tracking">
        <TrackingPanel data={data} />
      </TabsContent>
      <TabsContent value="capacity">
        <CapacityPanel data={data} />
      </TabsContent>
      <TabsContent value="admin">
        <AdminPanel data={data} />
      </TabsContent>
    </Tabs>
  )
}

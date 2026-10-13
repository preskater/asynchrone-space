"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import type { HrOverviewData } from "@/lib/hr/types"

import { HoursPanel } from "./hours-panel"
import { HrSummaryCards } from "./hr-summary-cards"
import { PresencePanel } from "./presence-panel"
import { TimeOffPanel } from "./time-off-panel"

export function HrWorkspace({ data }: { data: HrOverviewData }) {
  const t = useTranslations("Hr")

  return (
    <div className="flex flex-col gap-4">
      <HrSummaryCards data={data} />
      <Tabs defaultValue="presence" className="flex flex-col gap-4">
        <TabsList variant="line" className="w-full justify-start border-b pb-0">
          <TabsTrigger value="presence">{t("tabs.presence")}</TabsTrigger>
          <TabsTrigger value="timeOff">{t("tabs.timeOff")}</TabsTrigger>
          <TabsTrigger value="hours">{t("tabs.hours")}</TabsTrigger>
        </TabsList>
        <TabsContent value="presence">
          <PresencePanel data={data} />
        </TabsContent>
        <TabsContent value="timeOff">
          <TimeOffPanel data={data} />
        </TabsContent>
        <TabsContent value="hours">
          <HoursPanel data={data} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

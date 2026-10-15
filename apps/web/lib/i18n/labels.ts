"use client"

import { useTranslations } from "next-intl"

type Translator = ReturnType<typeof useTranslations<"Enums">>

export function enumLabels(t: Translator) {
  return {
    taskStatus: (value: string) => t(`taskStatus.${value}` as never),
    taskPriority: (value: string) => t(`taskPriority.${value}` as never),
    taskTemplateFieldType: (value: string) =>
      t(`taskTemplateFieldType.${value}` as never),
    projectStatus: (value: string) => t(`projectStatus.${value}` as never),
    orgRole: (value: string) => t(`orgRole.${value}` as never),
    orgRoleDescription: (value: string) =>
      t(`orgRoleDescription.${value}` as never),
    fileKind: (value: string) => t(`fileKind.${value}` as never),
    sharePermission: (value: string) => t(`sharePermission.${value}` as never),
    fileLocation: (value: string) => t(`fileLocation.${value}` as never),
    eventColor: (value: string) => t(`eventColor.${value}` as never),
    reminder: (value: string) => t(`reminder.${value}` as never),
    response: (value: string) => t(`response.${value}` as never),
    conversationKind: (value: string) =>
      t(`conversationKind.${value}` as never),
    presence: (value: string) => t(`presence.${value}` as never),
    attendanceStatus: (value: string) =>
      t(`attendanceStatus.${value}` as never),
    dayPeriod: (value: string) => t(`dayPeriod.${value}` as never),
    workLocationKind: (value: string) =>
      t(`workLocationKind.${value}` as never),
    leaveType: (value: string) => t(`leaveType.${value}` as never),
    leaveStatus: (value: string) => t(`leaveStatus.${value}` as never),
    balanceType: (value: string) => t(`balanceType.${value}` as never),
    activityKind: (value: string) => t(`activityKind.${value}` as never),
    employmentType: (value: string) => t(`employmentType.${value}` as never),
    contractType: (value: string) => t(`contractType.${value}` as never),
    salaryType: (value: string) => t(`salaryType.${value}` as never),
    crmClientStatus: (value: string) => t(`crmClientStatus.${value}` as never),
    crmActivityType: (value: string) => t(`crmActivityType.${value}` as never),
    crmFieldType: (value: string) => t(`crmFieldType.${value}` as never),
    dealStatus: (value: string) => t(`dealStatus.${value}` as never),
    pipelineStageType: (value: string) =>
      t(`pipelineStageType.${value}` as never),
    crmDocumentVisibility: (value: string) =>
      t(`crmDocumentVisibility.${value}` as never),
    resource: (value: string) => t(`resource.${value}` as never),
  }
}

export function useEnumLabel() {
  const t = useTranslations("Enums")
  return enumLabels(t)
}

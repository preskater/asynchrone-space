"use client"

import { useTranslations } from "next-intl"

const CODE_KEYS: Record<string, string> = {
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  not_found: "notFound",
  validation_error: "validation",
  conflict: "conflict",
  bad_request: "badRequest",
  internal_error: "internal",
  role_cannot_modify_projects: "roleCannotModifyProjects",
  role_cannot_manage_members: "roleCannotManageMembers",
  email_already_member: "emailAlreadyMember",
  role_cannot_modify_files: "roleCannotModifyFiles",
  file_permission_denied: "filePermissionDenied",
  storage_quota_exceeded: "storageQuotaExceeded",
  upload_offset_mismatch: "uploadOffsetMismatch",
  upload_size_mismatch: "uploadSizeMismatch",
  upload_checksum_mismatch: "uploadChecksumMismatch",
  role_cannot_modify_calendars: "roleCannotModifyCalendars",
  role_cannot_send_messages: "roleCannotSendMessages",
  label_color_already_used: "labelColorAlreadyUsed",
  role_cannot_modify_hr: "roleCannotModifyHr",
  role_cannot_manage_hr: "roleCannotManageHr",
  time_off_not_pending: "timeOffNotPending",
}

export function useErrorTranslator() {
  const t = useTranslations("Errors")
  const tEnums = useTranslations("Enums")

  return function translateError(
    error: unknown,
    fallbackKey?: string
  ): string {
    const err = error as {
      code?: string
      message?: string
      params?: { resource?: string }
    }
    const code = err?.code
    if (code && CODE_KEYS[code]) {
      if (code === "not_found") {
        const resource = err?.params?.resource
        return t("notFound", {
          resource: resource ? tEnums(`resource.${resource}` as never) : "",
        })
      }
      return t(CODE_KEYS[code] as never)
    }
    if (fallbackKey) return t(fallbackKey as never)
    return err?.message ?? t("internal")
  }
}

"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Building2Icon, MailIcon, UsersIcon } from "lucide-react"

import { DashboardEmpty } from "@/components/dashboard-empty"
import { OrganizationAppearanceForm } from "@/components/appearance/organization-appearance-form"
import { MeetingSettingsForm } from "@/components/meetings/meeting-settings-form"
import { OrganizationDangerZone } from "@/components/organization/danger-zone"
import { InvitationsTable } from "@/components/organization/invitations-table"
import { InviteMemberDialog } from "@/components/organization/invite-member-dialog"
import { MembersTable } from "@/components/organization/members-table"
import { OrganizationGeneralForm } from "@/components/organization/organization-general-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Spinner } from "@workspace/ui/components/spinner"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { authClient } from "@/lib/auth-client"
import { parseRoles } from "@/lib/organization/utils"
import { useOrgPermissions } from "@/lib/organization/use-permissions"

export function OrganizationSettings() {
  const t = useTranslations("Org")
  const tAppearance = useTranslations("Appearance")
  const tMeetings = useTranslations("MeetingRequests")
  const permissions = useOrgPermissions()
  const {
    data: organization,
    isPending,
    error,
    refetch,
  } = authClient.useActiveOrganization()
  const { data: session } = authClient.useSession()

  if (isPending) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  if (error || !organization) {
    return (
      <DashboardEmpty
        icon={Building2Icon}
        title={t("noActiveOrganization")}
        description={t("noActiveOrganizationDescription")}
        className="border"
      />
    )
  }

  const members = organization.members ?? []
  const invitations = organization.invitations ?? []
  const owners = members.filter((member) =>
    parseRoles(member.role).includes("owner")
  )
  const currentUserId = session?.user.id
  const isOnlyOwner =
    owners.length <= 1 &&
    owners.some((member) => member.userId === currentUserId)

  return (
    <Tabs defaultValue="general" className="flex flex-col gap-4">
      <TabsList variant="line" className="w-full justify-start border-b pb-0">
        <TabsTrigger value="general">{t("general")}</TabsTrigger>
        <TabsTrigger value="appearance">{tAppearance("title")}</TabsTrigger>
        <TabsTrigger value="meetings">{tMeetings("settingsTitle")}</TabsTrigger>
        <TabsTrigger value="members">{t("members")}</TabsTrigger>
        <TabsTrigger value="invitations">{t("invitations")}</TabsTrigger>
        <TabsTrigger value="danger">{t("dangerZone")}</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <OrganizationGeneralForm
          organization={organization}
          canEdit={permissions.canUpdateOrganization}
          onSaved={refetch}
        />
      </TabsContent>

      <TabsContent value="appearance">
        <OrganizationAppearanceForm />
      </TabsContent>

      <TabsContent value="meetings">
        <MeetingSettingsForm />
      </TabsContent>

      <TabsContent value="members">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="size-4" />
                  {t("members")}
                </CardTitle>
                <CardDescription>
                  {t("membersDescription", { name: organization.name })}
                </CardDescription>
              </div>
              {permissions.canInviteMember ? (
                <InviteMemberDialog onInvited={refetch} />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <MembersTable
              members={members}
              currentUserId={currentUserId ?? ""}
              canUpdate={permissions.canUpdateMember}
              canRemove={permissions.canDeleteMember}
              canTransferOwnership={permissions.isOwner}
              onChanged={refetch}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="invitations">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle className="flex items-center gap-2">
                  <MailIcon className="size-4" />
                  {t("invitations")}
                </CardTitle>
                <CardDescription>{t("invitationsDescription")}</CardDescription>
              </div>
              {permissions.canInviteMember ? (
                <InviteMemberDialog onInvited={refetch} />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <InvitationsTable
              invitations={invitations}
              canCancel={permissions.canCancelInvitation}
              onChanged={refetch}
            />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="danger">
        <OrganizationDangerZone
          organization={organization}
          isOwner={permissions.isOwner}
          isOnlyOwner={isOnlyOwner}
        />
      </TabsContent>
    </Tabs>
  )
}

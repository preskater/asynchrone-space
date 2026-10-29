import { getTranslations } from "next-intl/server"

import { OrganizationSettings } from "@/components/organization/organization-settings"
import { TrialCard } from "@/components/trial/trial-card"

export default async function SettingsPage() {
  const t = await getTranslations("AppPages")
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("settingsTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("settingsDescription")}
        </p>
      </div>
      <TrialCard />
      <OrganizationSettings />
    </div>
  )
}

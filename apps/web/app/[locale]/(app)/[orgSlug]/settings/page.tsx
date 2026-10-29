import { getTranslations } from "next-intl/server"

import { OrganizationSettings } from "@/components/organization/organization-settings"
import type { CheckoutReturn } from "@/components/billing/billing-panel"

function checkoutFrom(
  params: Record<string, string | string[] | undefined>
): CheckoutReturn | undefined {
  const status = params.checkout
  if (status !== "success" && status !== "cancelled") return undefined
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : null
  return { status, sessionId }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const t = await getTranslations("AppPages")
  const checkout = checkoutFrom(await searchParams)

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("settingsTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("settingsDescription")}
        </p>
      </div>
      <OrganizationSettings checkout={checkout} />
    </div>
  )
}

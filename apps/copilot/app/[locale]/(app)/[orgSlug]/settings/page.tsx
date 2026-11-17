import { getTranslations } from "next-intl/server"

import { appOrigin } from "@workspace/contracts/server"

import type { CheckoutReturn } from "@/components/billing/billing-panel"
import { DataExportCard } from "@/components/organization/data-export-card"
import { ExternalCollaborators } from "@/components/organization/external-collaborators"
import { OrganizationSettings } from "@/components/organization/organization-settings"
import { ApiTokensCard } from "@/components/settings/developers/api-tokens-card"
import { WebhookDeliveriesCard } from "@/components/settings/developers/webhook-deliveries-card"
import { WebhookSubscriptionsCard } from "@/components/settings/developers/webhook-subscriptions-card"
import { TrialCard } from "@/components/trial/trial-card"

import { can } from "@workspace/core/roles"

import { getOptionalRequestContext } from "@/lib/core/auth-context"
import { guestService, listShareableProjects } from "@/lib/guests"
import { getOrganizationEntitlements } from "@/lib/organization/entitlements"
import { getDeletionScheduledAt } from "@/lib/organization/deletion-service"
import { getTwoFactorPolicy } from "@/lib/organization/two-factor-policy"
import { listApiTokens } from "@/lib/public-api"
import { listWebhookDeliveries, listWebhookSubscriptions } from "@/lib/webhooks"

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
  const ctx = await getOptionalRequestContext()
  const canManageApi = Boolean(ctx && can(ctx, "member:manage"))
  const [
    deletionScheduledAt,
    twoFactorPolicy,
    apiTokens,
    webhookSubscriptions,
    webhookDeliveries,
  ] = ctx
    ? await Promise.all([
        getDeletionScheduledAt(ctx.organizationId),
        getTwoFactorPolicy(ctx),
        canManageApi ? listApiTokens(ctx) : Promise.resolve([]),
        canManageApi ? listWebhookSubscriptions(ctx) : Promise.resolve([]),
        canManageApi
          ? listWebhookDeliveries(ctx, { limit: 20 })
          : Promise.resolve({ items: [], nextCursor: null }),
      ])
    : [null, null, [], [], { items: [], nextCursor: null }]
  // External collaborators: owners and admins only (ADR 0041).
  let guestsCard: React.ReactNode = null
  if (ctx && can(ctx, "member:manage")) {
    const { externalCollaborators: limit } = await getOrganizationEntitlements(
      ctx.organizationId
    )
    const [guests, projects] =
      limit > 0
        ? await Promise.all([
            guestService.list(ctx),
            listShareableProjects(ctx).catch(() => []),
          ])
        : [[], []]
    guestsCard = (
      <ExternalCollaborators
        guests={guests}
        projects={projects}
        limit={limit}
      />
    )
  }
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-4 md:py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("settingsTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("settingsDescription")}
        </p>
      </div>
      <TrialCard />
      {/* Meeting settings moved with calendars (#161); the tab links there. */}
      <OrganizationSettings
        checkout={checkout}
        deletionScheduledAt={deletionScheduledAt}
        twoFactorPolicy={twoFactorPolicy}
        exportCard={<DataExportCard />}
        developersCard={
          canManageApi ? (
            <div className="flex flex-col gap-4">
              <ApiTokensCard tokens={apiTokens} />
              <WebhookSubscriptionsCard subscriptions={webhookSubscriptions} />
              <WebhookDeliveriesCard
                subscriptions={webhookSubscriptions}
                initial={webhookDeliveries}
              />
            </div>
          ) : undefined
        }
        guestsCard={guestsCard}
        calendarsUrl={appOrigin("calendars")}
      />
    </div>
  )
}

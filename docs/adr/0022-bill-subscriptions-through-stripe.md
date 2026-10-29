# Bill subscriptions through Stripe with a local plan state

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-29

## Context and Problem Statement

The plan an organization gets was a string in `organization.metadata.plan`,
written by a platform admin in the control tower. That meant no checkout, no
invoice, no tax handling, no dunning and no self-serve upgrade or downgrade:
the product could not take money. The pricing page already sells Starter, Team
(€12/month) and Enterprise, and the terms promise automatic renewal.

The product needs a plan state it can enforce (storage quota today, feature
entitlements next), a way to collect payment, and a record of what was billed —
without storing card data or writing accounting software.

## Decision Drivers

- Ship self-serve Team billing quickly, including VAT-compliant invoices.
- Never let card data touch Presk's database.
- Keep plan enforcement local, so a provider outage does not lock anyone out.
- Make webhook handling idempotent: providers retry, and a replayed delivery
  must not double-apply anything.
- Keep a documented manual override for Enterprise contracts, audited in the
  platform audit trail.
- Preserve existing organizations whose plan only exists in metadata.

## Considered Options

- Stripe Checkout + Customer Portal, with a local `Subscription`/`Invoice`
  mirror and webhook-driven plan state.
- Build card collection in-app with Stripe Elements and manage proration and
  invoices ourselves.
- Use a Merchant-of-Record (Paddle, Lemon Squeezy) and let it own tax entirely.
- Keep plans manual in the control tower and invoice by hand.

## Decision Outcome

Chosen option: "Stripe Checkout + Customer Portal with a local plan state",
because it removes all card handling from Presk, delegates tax and invoices to
the provider, and still leaves a plan column the app can enforce instantly.

`Subscription` (one row per organization) holds `plan`, `status`, provider
identifiers, `currentPeriodEnd`, `cancelAtPeriodEnd`, `trialEndsAt` and
`manualOverride`. `Invoice` mirrors provider invoices for the settings page.
`BillingEvent` is the idempotency log keyed by `(provider, eventId)`.

Checkout is provider-hosted for Team, monthly or yearly. Upgrades,
downgrades, payment-method changes and invoice downloads happen in the Customer
Portal. Stripe never runs its own trial: the Team trial is a card-less window modelled
on the organization ([ADR 0021](0021-team-trial-without-billing.md)), so
checkout charges the first invoice immediately. Canceling at period
end keeps Team until `currentPeriodEnd`, then `customer.subscription.deleted`
moves the workspace to Starter with all data intact.

Status maps to plan in one place (`lib/billing/plans.ts`): `active`, `trialing`
and `past_due` are Team; everything else is Starter. `past_due` deliberately
keeps the paid plan during the retry window — removing access to someone's own
data because a card expired is worse than the revenue at risk.

`checkout.session.completed`, `customer.subscription.created|updated|deleted`,
`invoice.paid` and `invoice.payment_failed` are handled. Each delivery is
claimed in `BillingEvent` before any side effect, so a replay returns
`duplicate` and changes nothing. The success redirect also syncs the checkout
session as a fallback when the webhook is delayed; both paths are idempotent.

A platform admin can still grant any plan from the control tower. That writes
the `Subscription` row with `provider = "manual"` and, for paid plans,
`manualOverride = true`; webhooks then leave the plan untouched until an admin
chooses "Release override". Every change — grant or release — appends a
`PlatformAuditEvent` with before/after state.

Organizations with no `Subscription` row keep reading `metadata.plan`, so the
migration needs no backfill.

### Positive Consequences

- Card data, SCA, dunning, proration, VAT and invoice PDFs are the provider's
  problem; Presk stores only ids, amounts and links.
- Plan enforcement is a local database read, not a network call.
- Webhook replays, duplicate deliveries and the checkout redirect racing the
  webhook are all safe.
- Enterprise contracts keep a human workflow without breaking the plan model.

### Negative Consequences

- Two sources of plan truth exist until every organization has a subscription
  row (legacy metadata fallback).
- The provider must be able to reach `/api/webhooks/stripe`; a misconfigured
  signing secret breaks plan changes until it is fixed (the route answers 503
  and logs loudly).
- Tax depends on provider configuration: automatic tax is opt-in through
  `STRIPE_AUTOMATIC_TAX` and needs a registration in the Stripe dashboard.
- Trials and their reminders stay out of billing: they belong to the
  organization trial window ([ADR 0021](0021-team-trial-without-billing.md)).

## Pros and Cons of the Options

### Stripe Checkout + Customer Portal

- Good, because no card data reaches Presk and SCA is handled.
- Good, because invoices, VAT and the billing portal are maintained by Stripe.
- Bad, because upgrade/downgrade UI is Stripe's branding, not ours.

### In-app Elements

- Good, because the flow stays inside the product.
- Bad, because it adds PCI scope, proration logic and invoice rendering.

### Merchant of Record

- Good, because it owns tax registration and remittance end to end.
- Bad, because it takes a larger cut and constrains payouts and pricing.

### Manual invoicing only

- Good, because there is nothing to build.
- Bad, because it blocks self-serve signup, trials and every plan-gated feature.

## Links

- `packages/db/prisma/schema.prisma` — `Subscription`, `Invoice`,
  `BillingEvent`
- `apps/web/lib/billing/` — provider port, Stripe implementation, service,
  webhook payload parsers
- `apps/web/app/api/webhooks/stripe/route.ts` — signed webhook endpoint
- `apps/web/components/billing/billing-panel.tsx` — Settings → Billing
- `apps/control-tower/actions/organizations.ts` — manual override + release
- `docs/billing.md` — operations and test-mode procedure

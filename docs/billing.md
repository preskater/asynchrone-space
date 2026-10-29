# Billing

Plans are paid through Stripe Checkout and managed in the Stripe Customer
Portal. Presk keeps a local mirror of the subscription and invoices so the app
can enforce limits without calling the provider. The decision is recorded in
[ADR 0020](adr/0020-bill-subscriptions-through-stripe.md).

## Where things live

| Concern | Location |
| --- | --- |
| Tables | `Subscription`, `Invoice`, `BillingEvent` (`packages/db/prisma/schema.prisma`) |
| Plan state and status mapping | `apps/web/lib/billing/plans.ts` |
| Stripe client and request shaping | `apps/web/lib/billing/stripe-provider.ts` |
| Webhook handling | `apps/web/lib/billing/service.ts`, `apps/web/app/api/webhooks/stripe/route.ts` |
| Settings → Billing | `apps/web/components/billing/billing-panel.tsx` |
| Billing tab deep link | `/{locale}/{orgSlug}/settings?tab=billing` (also the user menu's "Billing") |
| Trial reminder job | `apps/web/app/api/cron/billing-trials/route.ts` |
| Manual override | `apps/control-tower/actions/organizations.ts` |

Plan resolution order: `Subscription.plan` first, then the legacy
`organization.metadata.plan`. Organizations created before billing existed need
no backfill.

## Configuration

Set these in `apps/web/.env` (or the `presk-web-secrets` Secret in production):

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | API key. Empty disables checkout and the portal but keeps the plan readable. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret of the endpoint below. Required for webhooks. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Reserved for Elements/embedded checkout; not needed for hosted Checkout. |
| `STRIPE_PRICE_TEAM_MONTHLY` / `STRIPE_PRICE_TEAM_YEARLY` | Optional Price IDs. When empty, Checkout receives the Team price inline (€12 / €120). |
| `STRIPE_AUTOMATIC_TAX` | `true` turns on Stripe Tax and requires a billing address. Needs a tax registration in Stripe. |
| `STRIPE_TEAM_TRIAL_DAYS` | Trial length on a first checkout. Defaults to `14`; `0` charges immediately, so the subscription is `active` instead of `trialing`. |

If `STRIPE_WEBHOOK_SECRET` is set without `STRIPE_SECRET_KEY` the app refuses to
boot (`lib/env.ts`).

## Test-mode procedure

1. Create a Stripe account, stay in **test mode**, and copy the test secret key
   into `STRIPE_SECRET_KEY`.

2. Install the Stripe CLI and forward webhooks to the app. Recent CLI versions
   require an explicit event selection (`--events`, `--all-snapshot` or
   `--all-thin`):

   ```bash
   stripe listen \
     --forward-to localhost:3000/api/webhooks/stripe \
     --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment.failed
   ```

   That list is exactly what the handler consumes. Use `--all-snapshot` to
   forward everything instead. **Do not use `--all-thin`**: thin events carry
   only a reference, and this endpoint parses snapshot payloads
   (`event.data.object`), so they would be ignored.

   `localhost:3000` is `npm run dev`; under `docker compose` the web app is on
   `localhost:3002`. The port must match `BETTER_AUTH_URL` (or
   `NEXT_PUBLIC_APP_URL` when set), because the same origin is used for the
   Checkout success/cancel URLs.

   Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`, then restart the
   app (`npm run dev`, or `docker compose up -d web` to recreate the container
   so it picks up the new env value).

3. Sign in, open a workspace, go to **Settings → Billing** and click
   **Monthly — €12**. Pay with `4242 4242 4242 4242`, any future expiry and any
   CVC. Yearly uses the same form.

4. Verify the plan flipped without touching the database:

   ```bash
   psql "$DATABASE_URL" -c 'select "organizationId", plan, status, "billingInterval", "currentPeriodEnd" from subscription;'
   ```

   Expect `plan = team`, `status = active` once Stripe has collected the test
   card. With the default 14-day trial the first checkout reports `trialing`
   instead, so set `STRIPE_TEAM_TRIAL_DAYS=0` while testing the payment flow.

5. Replay an event to confirm idempotency. `stripe listen` prints event ids:

   ```bash
   stripe events resend evt_…
   ```

   The response is `{"received":true,"outcome":"duplicate"}` and nothing
   changes. `billingEvent` has one row per event id.

6. Exercise the lifecycle:

   | Scenario | Stripe CLI | Expected |
   | --- | --- | --- |
   | Cancel at period end | `stripe subscriptions update sub_… --cancel-at-period-end` | `cancelAtPeriodEnd = true`, plan stays `team` |
   | End the period early | `stripe subscriptions cancel sub_…` | `status = canceled`, plan `free`, data intact |
   | Failed payment | `stripe trigger invoice.payment_failed` | `status = past_due`, plan stays `team`, owners notified |
   | Paid invoice | `stripe trigger invoice.paid` | invoice row `paid`, `paidAt` set |

7. Open **Manage subscription** to confirm the Customer Portal loads (payment
   methods, switches, invoice downloads).

8. Confirm no card data reached Presk: `invoice` stores only ids, amounts,
   currency and hosted links; `billingEvent` stores the event id and type.

## Production checklist

- Register the endpoint `https://<app-host>/api/webhooks/stripe` for
  `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.paid` and `invoice.payment_failed`.
- Enable the Customer Portal in Stripe with cancellation and plan switching
  allowed; the app never edits subscriptions itself.
- Configure tax registrations before setting `STRIPE_AUTOMATIC_TAX=true`.
- Keep `CRON_SECRET` set so `presk-web-billing-trials` (daily 09:00) can call
  the reminder route.
- Do not reuse test keys in production, and never commit either key.

## Manual overrides and Enterprise

The control tower can grant any plan (Plan & quota card on an organization).
Saving writes `Subscription` with `provider = "manual"` and, for paid plans,
`manualOverride = true`; webhooks then leave the plan alone so a contract does
not get overwritten by Stripe state. Each change appends a `PlatformAuditEvent`
(`organization.plan.update`).

**Release override** clears the flag and hands the plan back to the provider on
the next webhook without changing the current plan in the meantime. Releasing
is audited as `organization.plan.release`.

## Known limits

- Usage-based metering, revenue recognition, accounting exports, filing VAT
  returns and non-Stripe currencies are out of scope.
- Downgrading keeps rows and files; writes that exceed the new storage quota
  are rejected by the existing quota checks (`lib/files/storage.ts`). Other
  feature limits belong to the entitlement layer.

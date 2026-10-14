# CRM roadmap — remaining work

Companion to [`crm-feature-roadmap.md`](../crm-feature-roadmap.md) (the planning
document). This file lists the features that are **not implemented yet**, and
the partial ones with exactly what is missing, so the remaining scope can be
worked item by item. Status as of 2026-10-14 — update this file as items land.

For context, the shipped CRM core (companies, contacts, configurable pipelines
and kanban deals, activities/timeline, custom fields, CSV import/export,
archive/restore, audit entries, viewer/member/admin access and MCP tools) is
described in [ADR-0012](adr/0012-extend-clients-into-crm-core.md); the code
lives in `apps/web/lib/crm/`, `apps/web/actions/crm.ts` and
`apps/web/components/crm/`.

## Remaining items at a glance

| #  | Feature                             | Status      | Main gap                                                     |
| -- | ----------------------------------- | ----------- | ------------------------------------------------------------ |
| 8  | Client portal                       | not started | Dedicated client accounts + read-only project view           |
| 9  | Documents on records                | partial     | No link between files and companies/contacts/deals           |
| 10 | Notifications                       | not started | No in-app/email notification system at all                   |
| 11 | Dashboards & reporting              | partial     | Only per-page stat cards, no report pages                    |
| 12 | Permissions & data access           | partial     | No custom roles, field-level or record-level rules           |
| 13 | Email integration                   | not started | No mailbox connection or email logging                       |
| 14 | Calendar integration                | partial     | Events not linked to CRM records, no external sync           |
| 15 | Quotes & contracts                  | not started | —                                                            |
| 16 | Invoicing & payments                | not started | —                                                            |
| 17 | Time tracking                       | partial     | No timer, task-level entries, rates per project/service      |
| 18 | Automation engine                   | not started | —                                                            |
| 19 | Forms & lead capture                | not started | —                                                            |
| 20 | Client requests & tickets           | not started | —                                                            |
| 21 | Templates                           | partial     | Only task templates (projects); no email/proposal/onboarding |
| 22 | Advanced search & saved views       | partial     | Global search page is a placeholder; no saved views          |
| 23 | Integrations                        | not started | —                                                            |
| 24 | Public API & webhooks               | partial     | MCP + OAuth2 only; no REST API, API keys or webhooks         |
| 25 | Communication products              | not started | —                                                            |
| 26 | Marketing automation                | not started | —                                                            |
| 27 | AI-assisted features                | partial     | Assistant + MCP tools only; no summaries/suggestions         |
| 28 | Resource planning                   | partial     | HR capacity/leave only; no deal/project allocation forecast  |
| 29 | Financial profitability             | partial     | Costs in HR payroll; no margins or revenue recognition       |
| 30 | Mobile experience                   | partial     | Responsive web only; no PWA or native apps                   |

## P0 — remaining

### 8. Client portal — not started

- Secure client accounts, separate from internal users (email/password with
  optional magic link, or invitation-based restricted members — decide first).
- Scoping: which client sees which projects (`project.clientId` already links
  projects to companies, so visibility can key off that).
- Read-only project view: status, progress, milestones, latest updates and
  documents, with no editing of internal data.
- Internal-vs-client-visible flag on activities and documents (see #9); optional
  client comments/validation requests on deliverables.
- Depends on: #9 (document visibility tiers) and #10 (notifications for portal
  activity).

### 9. Documents & deliverables — partial

Existing: files module (`apps/web/lib/files/`) with large-object storage,
versions (`FileVersion`), shares (`FileShare`) and a file activity log
(`FileActivity`).

Missing:

- No link between `FileNode` and companies/contacts/deals, so record pages
  cannot list their documents (roadmap: "upload documents to companies,
  contacts, deals, tasks, projects").
- No internal / client-visible / per-client-user access tier (needed by #8).
- No CRM-side document section on company/contact/deal detail pages.

### 10. Notifications — not started

- In-app notifications + email for critical events, per-user preferences,
  read/unread state.
- Events from the roadmap: task assignment, due dates, mentions, deal changes,
  project updates, portal activity.
- This is a foundational item: #6 (task reminders), #8 (client updates) and
  #13 (email alerts) all depend on it.

## P1 — remaining

### 11. Dashboards & reporting — partial

- Existing: per-page stat cards (open pipeline, weighted forecast, won last 30
  days, counts) and HR's own reports/exports in `/[org]/hr`.
- Missing: personal and agency dashboards, pipeline-by-stage, won/lost analysis,
  average deal size, sales-cycle duration, conversion rates, revenue forecast,
  project at-risk/late-milestone reports, client revenue reports.

### 12. Permissions & data access control — partial

- Existing: organization roles (owner/admin/member/viewer) enforced per module;
  CRM access in `apps/web/lib/crm/access.ts` (viewer read-only, member edits +
  import/export, admin manages pipelines/custom fields). CRM actions write
  `AuditLog` entries.
- Missing: custom roles; module-level permission matrix (view/create/edit/
  delete/export); field-level permissions; record-level visibility (own/team/
  all records); an audit-log viewer for CRM events (HR has an admin-only audit
  export).

### 13. Email integration — not started

- Connect an inbox (Google/Microsoft), send from the CRM, log inbound/outbound
  mail onto contacts/companies/deals, templates with variables, delivery/open
  tracking, attachments.

### 14. Calendar & meetings — partial

- Existing: calendars module (`apps/web/lib/calendars/`, `CalendarEvent`,
  attendees), meetings UI in `apps/web/components/meetings/`.
- Missing: linking events to contacts/companies/deals; Google Calendar /
  Outlook sync; scheduling links/availability sharing; meeting outcome capture
  into CRM tasks.

### 15. Quotes, contracts & approvals — not started

- Quotes from deal data with line items, templates, PDF generation, statuses
  (draft/sent/viewed/accepted/rejected/expired), e-signature, conversion into a
  project/invoice.

### 16. Invoicing & payments — not started

- Invoices from quotes/projects, recurring invoices, statuses, payment
  tracking/reminders, revenue reporting, accounting/payment integrations.
- Depends on #15 for quote-to-invoice conversion.

### 17. Time tracking — partial

- Existing: HR attendance allocates half-days to projects (`/[org]/hr`,
  `AttendanceEntry.projectId`, billable flag), planned vs allocated hours
  (tracking/capacity tabs), payroll and cost data.
- Missing: timer, entries linked to tasks/CRM records, hourly rates per
  project/service, conversion of billable time into invoices (blocked by #16).

## P2 — remaining

### 18. Automation engine — not started

- Triggers (record created, stage changed, task completed, date reached, form
  submitted, email received), actions, templates, execution logs, rate limits.

### 19. Forms & lead capture — not started

- Public forms, builder, spam protection, automatic company/contact/deal
  creation, routing rules, confirmation emails.

### 20. Client request & ticket management — not started

- Intake (portal/email/form), categories, priority/SLA/status, conversion to
  project or task, client-visible status, internal notes.

### 21. Templates & standardization — partial

- Existing: task templates in the projects module (`TaskTemplate`).
- Missing: project, milestone, email, proposal, onboarding and service-package
  templates.

### 22. Advanced search, filters & saved views — partial

- Existing: per-list search/filters (projects, CRM clients/contacts/deals).
- Missing: the global search page (currently a placeholder at
  `/[org]/search`), saved personal/shared views, sorting/pagination beyond
  current lists, bulk edit, bulk export, saved reports. Searching across
  companies and contacts solves the remaining part of roadmap item #2.

### 23. Integrations — not started

- Google Workspace, Microsoft 365, Slack/Teams, Stripe, accounting tools,
  e-signature providers, Zapier/Make.

### 24. Public API & webhooks — partial

- Existing: the MCP endpoint (`apps/web/app/mcp/route.ts`) secured with OAuth2
  exposes assistant tools, including CRM tools in `apps/web/lib/mcp/tools/crm.ts`
  ([ADR-0006](adr/0006-expose-ai-assistant-over-mcp.md),
  [ADR-0011](adr/0011-authenticate-mcp-with-oauth2.md)).
- Missing: REST/GraphQL API, API keys, rate limiting, webhooks for major
  events, API documentation, sandbox environment.

## P3 — remaining

### 25. Communication product integrations — not started

- LinkedIn planning/publishing, social performance, content calendar, campaign
  management, email sequences, per-client communication reporting, lead
  attribution.

### 26. Marketing automation — not started

- Multi-step sequences, drip campaigns, lead scoring, behavioral tracking,
  campaign attribution, segmentation.

### 27. AI-assisted features — partial

- Existing: the assistant (chat + MCP tools) can read and write CRM data
  through `lib/mcp/tools/crm.ts`.
- Missing: meeting summaries, AI project status updates, suggested next
  actions, email drafting, deal-risk detection, request categorization,
  semantic search over notes/documents.

### 28. Resource planning — partial

- Existing: HR capacity views, leave/absence data, capacity alerts.
- Missing: allocations tied to deals/projects with forecasting, conflict
  detection beyond threshold alerts, skill-based assignment.

### 29. Financial profitability — partial

- Existing: payroll costs in HR (gross/net/total cost per member).
- Missing: margins per project/client/service, internal cost from time and
  rates, revenue recognition, forecast vs actual (depends on #16).

### 30. Mobile experience — partial

- Existing: the web app is responsive.
- Missing: installable PWA, native apps (only if justified by usage).

## Suggested order

1. **#10 Notifications** — small foundation that #6, #8 and #13 will reuse.
2. **#9 Document links + visibility flag** — extend `FileNode` with CRM
   references; unblocks #8.
3. **#22 Global search page** — the route exists and is empty; add companies,
   contacts and deals first.
4. **#11 CRM dashboard** — build on the existing stat computations.
5. **#8 Client portal** — the biggest P0 gap; needs #9 and #10 in place.
6. **#15 → #16 → #17/#29 chain** — quotes, then invoices, then billable time
   and profitability.

## Conventions when landing an item

- Server pattern: `lib/<domain>/{repository,service,schemas,types}.ts` plus
  `actions/<domain>.ts`; the CRM lives in `apps/web/lib/crm/` and `actions/crm.ts`.
- i18n: every user-facing string goes to both `apps/web/messages/en/*` and
  `apps/web/messages/fr/*`; enum labels in `enums.json`; error codes in
  `lib/core/errors.ts` + `lib/i18n/errors.ts` + `errors.json`.
- Schema changes: edit `apps/web/prisma/schema.prisma`, run
  `npx prisma migrate dev --name <change>` from `apps/web`, then
  `npx prisma generate` and restart `next dev` (stale client otherwise).
- Verify before finishing: `npm run lint && npm run typecheck && npm run build`
  (web workspace), matching CI.
- Architectural decisions: add a new record to `docs/adr/` and update its index.

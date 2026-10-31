# Clients / Employees query audit (2026-10-21)

Goal: remove per-request growth in the authenticated app shell and stop list
screens from loading whole tables.

## What changed

### App shell (`app/[locale]/(app)/layout.tsx`)

The layout now loads shell-only data:

| Feature   | Shell payload                                                           | Loaded by                            |
| --------- | ----------------------------------------------------------------------- | ------------------------------------ |
| Projects  | projects, members, labels, templates, task counters                     | `projectService.listShell`           |
| Calendars | calendar sources                                                        | `calendarService.listShell`          |
| Messaging | conversations, teams, presence, latest message preview per conversation | `messagingService.list`              |
| Files     | nothing (`EMPTY_FILES_DATA`)                                            | `FilesWorkspace` → `listFilesAction` |

Tasks + project activity hydrate through `loadProjectWorkspaceAction` when a
projects page (or the calendar “show tasks” toggle) mounts. Calendar events
hydrate through `listCalendarEventsAction` for a bounded window (−6 months /
+12 months). File versions and per-file activity are capped at 20 rows.

### Message history

`MessagingService.list()` no longer reads the `message` table (except one
latest-message preview per conversation). `listMessages(conversationId,
cursor?)` returns 50 top-level messages ordered by `(createdAt, id)`, with the
latest 50 replies per parent. The client store keeps loaded pages and offers
“load earlier messages”; polling refreshes only the active conversation’s
newest page.

### Keyset pagination

`lib/core/pagination.ts` provides opaque cursors and `toPage()`.

| List                  | Order                      | Cursor                      | Page size |
| --------------------- | -------------------------- | --------------------------- | --------- |
| Clients clients       | `name, id`                 | `[name, id]`                | 50        |
| Clients contacts      | `lastName, firstName, id`  | `[lastName, firstName, id]` | 50        |
| Clients deals         | `createdAt desc, id desc`  | `[createdAt, id]`           | 50        |
| Clients activities    | `occurredAt desc, id desc` | `[occurredAt, id]`          | 30 / 50   |
| Project activities    | `createdAt desc, id desc`  | `[createdAt, id]`           | 50 / 100  |
| Members               | `createdAt, id`            | `[createdAt, id]`           | 50        |
| Conversation messages | `createdAt desc, id desc`  | `[createdAt, id]`           | 50        |

Exposed through server actions (`listCrm*Action`, `listProjectActivitiesAction`,
`listMembersPageAction`) and the REST `/api/members` endpoint.

## N+1 / over-fetch findings

1. **Clients overview loaded every row of clients, contacts, deals and projects**,
   then computed per-client counters in memory (O(clients × rows)).
   Replaced by grouped aggregates:
   `contactCountsByClient`, `openDealCountsByClient`,
   `projectCountsByClient`, `openDealCountsByContact`, `stageDealStats`,
   `clientStatusCounts`, plus one SQL aggregate for deal KPIs.
2. **`listPipelines` included every deal** just to count/value stages.
   Removed; `stageDealStats` now groups by `stageId`.
3. **`saveClient` / `saveContact` / `returnClient` reloaded the full workspace**
   after every write. Replaced with scoped counts / `memberExists` checks.
4. **`saveDeal` loaded every deal** to compute a stage position; replaced with
   `countDealsInStage`.
5. **`moveDeal` loaded every deal** to reorder siblings; replaced with
   `listDealPositions(stageId)`.
6. **Clients import loaded all contacts** for email dedupe; now selects only
   `email` (`listContactEmails`).
7. **Employees `setDayStatus` called `setAttendance` per half-day**, repeating the
   access/profile lookup and project validation. Access is resolved once and
   both halves write in parallel.
8. **Employees `fetchTracking` ran four lookups sequentially**; they now run in one
   `Promise.all`.
9. **Employees overview loaded all allocation entries ever recorded**; project totals
   are now bounded to the current year.

## Remaining known costs

- Export/CSV paths intentionally read the full dataset for the selected entity.
- `getClientDetail` / `getDealDetail` still load all contacts/projects of that
  single record (bounded by the record, not the organization).
- File access resolution still walks the folder tree in memory from a full
  `fileNode` list (needed for inherited permissions).
- Better Auth’s `useActiveOrganization()` (organization settings → Members)
  returns the member list without app-level keyset pagination.

# Client meeting requests

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-21

## Context and Problem Statement

Issue #54 asks for clients to request a meeting with the team from their
workspace (the client portal):

- the request must fall inside a defined timeline (how soon and how far ahead a
  meeting can be booked);
- the client proposes several candidate times, the team accepts one (or
  declines), and the confirmed meeting appears on the calendar;
- online meetings carry a join link and an optional password, in-person
  meetings carry an address;
- administrators can enable or disable client requests;
- overlapping requests are refused automatically, unless the organization
  disables that rule;
- owners and admins will later connect a meeting app (Google Meet, Microsoft
  Teams, Zoom), so the acceptance flow must not be rewritten then.

## Decision Drivers

- Client-portal users are organization members linked to a `Client`; they never
  reach the workspace services.
- Accepted meetings must show up in the existing calendar, with the same
  details as any other event.
- Overlap detection must consider the team's real schedule, not only other
  requests.
- The booking rules are organization-wide and need typed validation.
- Meeting apps are out of scope for now but are a stated next step.

## Considered Options

- **A: Store requests as `CalendarEvent` rows with a status.** Rejected:
  calendar events are booked meetings, attendees are member users, and a
  pending proposal is not on the calendar yet.
- **B: Dedicated `MeetingRequest` and `MeetingSettings` models.** Chosen: the
  proposal lifecycle, the client link and the decision trail are explicit, and
  the organization rules are typed columns.
- **C: Store the settings in `Organization.metadata`.** Rejected: the settings
  are read on every portal visit and validated in several places; a typed model
  with defaults is cheaper to reason about (the appearance feature already
  shows the cost of a schemaless blob).

## Decision Outcome

Chosen option: **B**.

- `MeetingRequest` is a **proposal**, not a booking: it stores the title,
  mode (`online` | `in_person`), the client-provided join details, the
  `pending | accepted | declined | cancelled` status, who decided and the
  optional `calendarEventId` of the booked event. Its `MeetingSlot` children
  hold 2–5 candidate times of the same duration; the team confirms exactly one,
  which is marked `selected`.
- `MeetingSettings` is one row per organization (defaults apply when missing):
  `clientRequestsEnabled`, `autoDeclineOverlaps`, `bookingWindowDays`,
  `minNoticeHours`, `defaultDurationMinutes`, `maxDurationMinutes` and
  `provider`.
- `lib/meetings/service.ts` enforces the booking window, minimum notice,
  duration and mode-specific fields for every proposed slot. Each slot is
  checked against pending or accepted requests **and** events booked on team
  calendars. With `autoDeclineOverlaps`, a proposal is refused with
  `meeting_overlap` only when **every** proposed slot conflicts; otherwise it
  is sent to the team with the conflicting slots flagged as unavailable.
- Accepting a request requires a `slotId`; the chosen slot is re-checked when
  `autoDeclineOverlaps` is on, then booked as a `CalendarEvent` on the team
  calendar (`ensureTeamCalendar` creates a "Team meetings" calendar on demand).
  The join link, password or address are copied and the client's portal users
  are notified. Declining records the reason and notifies them too.
- Meeting apps: `lib/meetings/providers.ts` defines a `MeetingProviderAdapter`
  contract. The built-in `manual` adapter uses the client's details; the other
  provider ids are registered but throw `meeting_provider_not_connected` until
  a connection is implemented. `MeetingRequest.provider`,
  `externalMeetingId` and `externalJoinUrl` already persist the provider
  result, so connecting an app only adds credentials storage, an adapter and a
  settings entry.
- UI: the portal page `/portal/meetings` hosts the request form and the status
  list; the team inbox opens from the calendar header; Settings → Meetings
  exposes the rules to owners and admins.
- Notifications: `meeting.requested` goes to internal members, `meeting.decided`
  to the client's portal users.

### Positive Consequences

- Accepted meetings behave exactly like other calendar events, including
  attendee responses and reminders.
- Booking rules are validated server-side and are configurable without code.
- The provider seam is isolated, so connecting a meeting app does not touch the
  request lifecycle or the calendar code.

### Negative Consequences

- A pending proposal is not shown on the calendar; the team discovers it
  through the inbox and the notification bell and must choose a slot.
- While no meeting app is connected, the portal requires the client to provide
  the join link for online meetings.
- The client portal has no notification bell yet: decisions appear as status
  changes on the meetings page (notifications are still recorded).

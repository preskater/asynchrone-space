import "dotenv/config"

import assert from "node:assert/strict"

import { meetingService } from "../lib/meetings"
import type { RequestContext } from "../lib/core/context"
import type { PortalContext } from "../lib/portal/context"
import { prisma, pool } from "../lib/prisma"

const stamp = Date.now()
const orgId = `tmp-org-${stamp}`
const slug = `tmp-meetings-${stamp}`
const clientId = `tmp-client-${stamp}`
const portalUserId = `tmp-portal-${stamp}`
const staffUserId = `tmp-staff-${stamp}`

function slot(dayOffset: number, hour = 10, minutes = 0) {
  const start = new Date()
  start.setDate(start.getDate() + dayOffset)
  start.setHours(hour, minutes, 0, 0)
  return start
}

function errorCode(error: unknown): string | undefined {
  return (error as { code?: string }).code
}

async function main() {
  await prisma.organization.create({
    data: { id: orgId, name: `Tmp meetings ${stamp}`, slug, createdAt: new Date() },
  })
  await prisma.user.createMany({
    data: [
      {
        id: portalUserId,
        name: "Portal User",
        email: `tmp_portal_${stamp}@example.com`,
      },
      {
        id: staffUserId,
        name: "Staff User",
        email: `tmp_staff_${stamp}@example.com`,
      },
    ],
  })
  await prisma.client.create({
    data: { id: clientId, organizationId: orgId, name: `Tmp client ${stamp}` },
  })
  await prisma.member.createMany({
    data: [
      {
        id: `tmp-pm-${stamp}`,
        organizationId: orgId,
        userId: portalUserId,
        role: "client",
        clientId,
        createdAt: new Date(),
      },
      {
        id: `tmp-sm-${stamp}`,
        organizationId: orgId,
        userId: staffUserId,
        role: "admin",
        createdAt: new Date(),
      },
    ],
  })

  const portal: PortalContext = {
    userId: portalUserId,
    userName: "Portal User",
    userEmail: `tmp_portal_${stamp}@example.com`,
    organizationId: orgId,
    organizationName: `Tmp meetings ${stamp}`,
    organizationSlug: slug,
    clientId,
    clientName: `Tmp client ${stamp}`,
  }
  const staff: RequestContext = {
    userId: staffUserId,
    userName: "Staff User",
    userEmail: `tmp_staff_${stamp}@example.com`,
    organizationId: orgId,
    role: "admin",
  }

  const initial = await meetingService.getPortalMeetings(portal)
  assert.equal(initial.settings.clientRequestsEnabled, true)
  assert.equal(initial.requests.length, 0)

  const firstA = slot(3, 10)
  const firstB = slot(3, 14)
  const request = await meetingService.createRequest(portal, {
    title: "Project demo",
    description: "Show the new dashboard",
    durationMinutes: 30,
    slots: [
      { startAt: firstA.toISOString() },
      { startAt: firstB.toISOString() },
    ],
    mode: "online",
    meetingUrl: "https://meet.example.com/demo",
    meetingPassword: "1234",
    address: undefined,
  })
  assert.equal(request.status, "pending")
  assert.equal(request.slots.length, 2)
  assert.equal(request.slots.filter((entry) => entry.hasConflict).length, 0)

  // Every proposed slot overlaps the first request: refused.
  await assert.rejects(
    meetingService.createRequest(portal, {
      title: "All overlapping",
      durationMinutes: 30,
      slots: [
        { startAt: slot(3, 10, 15).toISOString() },
        { startAt: slot(3, 14, 15).toISOString() },
      ],
      mode: "online",
      meetingUrl: "https://meet.example.com/overlap",
      meetingPassword: undefined,
      address: undefined,
    }),
    (error: unknown) => errorCode(error) === "meeting_overlap"
  )

  // One free slot is enough for the proposal to reach the team.
  const partial = await meetingService.createRequest(portal, {
    title: "Partial overlap",
    durationMinutes: 30,
    slots: [
      { startAt: slot(3, 10, 15).toISOString() },
      { startAt: slot(4, 10).toISOString() },
    ],
    mode: "online",
    meetingUrl: "https://meet.example.com/partial",
    meetingPassword: undefined,
    address: undefined,
  })
  assert.equal(partial.slots[0]?.hasConflict, true)
  assert.equal(partial.slots[1]?.hasConflict, false)

  // Timeline rules and duplicates.
  await assert.rejects(
    meetingService.createRequest(portal, {
      title: "Too soon",
      durationMinutes: 30,
      slots: [
        { startAt: slot(0, 9).toISOString() },
        { startAt: slot(5, 10).toISOString() },
      ],
      mode: "online",
      meetingUrl: "https://meet.example.com/soon",
      meetingPassword: undefined,
      address: undefined,
    }),
    (error: unknown) => errorCode(error) === "meeting_slot_too_soon"
  )
  await assert.rejects(
    meetingService.createRequest(portal, {
      title: "Duplicate",
      durationMinutes: 30,
      slots: [
        { startAt: slot(5, 10).toISOString() },
        { startAt: slot(5, 10).toISOString() },
      ],
      mode: "online",
      meetingUrl: "https://meet.example.com/duplicate",
      meetingPassword: undefined,
      address: undefined,
    }),
    (error: unknown) => errorCode(error) === "meeting_slots_duplicate"
  )
  await assert.rejects(
    meetingService.createRequest(portal, {
      title: "Too few",
      durationMinutes: 30,
      slots: [{ startAt: slot(5, 10).toISOString() }],
      mode: "online",
      meetingUrl: "https://meet.example.com/one",
      meetingPassword: undefined,
      address: undefined,
    }),
    (error: unknown) => errorCode(error) === "meeting_slots_invalid"
  )

  const inbox = await meetingService.listRequests(staff)
  assert.equal(inbox.requests.filter((entry) => entry.status === "pending").length, 2)

  // Accept the first proposal at its second slot.
  const accepted = await meetingService.acceptRequest(staff, {
    id: request.id,
    slotId: request.slots[1]!.id,
    note: "See you there",
  })
  assert.equal(accepted.status, "accepted")
  assert.ok(accepted.calendarEventId)
  assert.equal(accepted.slots.filter((entry) => entry.selected).length, 1)
  assert.equal(accepted.slots[1]?.selected, true)

  const event = await prisma.calendarEvent.findUniqueOrThrow({
    where: { id: accepted.calendarEventId! },
    include: { attendees: true, calendar: true },
  })
  assert.equal(event.startAt.getTime(), firstB.getTime())
  assert.equal(event.meetingUrl, "https://meet.example.com/demo")
  assert.equal(event.meetingPassword, "1234")
  assert.equal(event.calendar.kind, "team")
  assert.ok(event.attendees.some((entry) => entry.userId === staffUserId))

  // Unknown slot is rejected.
  await assert.rejects(
    meetingService.acceptRequest(staff, {
      id: partial.id,
      slotId: "missing-slot",
    }),
    (error: unknown) => errorCode(error) === "not_found"
  )

  const declined = await meetingService.declineRequest(staff, {
    id: partial.id,
    note: "Busy",
  })
  assert.equal(declined.status, "declined")

  const cancellable = await meetingService.createRequest(portal, {
    title: "Cancel me",
    durationMinutes: 30,
    slots: [
      { startAt: slot(6, 10).toISOString() },
      { startAt: slot(6, 15).toISOString() },
    ],
    mode: "in_person",
    meetingUrl: undefined,
    meetingPassword: undefined,
    address: "1 Test Street, Paris",
  })
  const cancelled = await meetingService.cancelRequest(portal, cancellable.id)
  assert.equal(cancelled.status, "cancelled")

  // Disable requests.
  await meetingService.updateSettings(staff, {
    clientRequestsEnabled: false,
    autoDeclineOverlaps: true,
    bookingWindowDays: 30,
    minNoticeHours: 24,
    defaultDurationMinutes: 30,
    maxDurationMinutes: 120,
    provider: "manual",
  })
  await assert.rejects(
    meetingService.createRequest(portal, {
      title: "Disabled",
      durationMinutes: 30,
      slots: [
        { startAt: slot(7, 10).toISOString() },
        { startAt: slot(7, 15).toISOString() },
      ],
      mode: "in_person",
      meetingUrl: undefined,
      meetingPassword: undefined,
      address: "2 Test Street, Paris",
    }),
    (error: unknown) => errorCode(error) === "meeting_requests_disabled"
  )

  const notifications = await prisma.notification.findMany({
    where: { organizationId: orgId },
    select: { type: true, userId: true },
  })
  assert.ok(
    notifications.some(
      (entry) =>
        entry.type === "meeting.requested" && entry.userId === staffUserId
    )
  )
  assert.ok(
    notifications.some(
      (entry) =>
        entry.type === "meeting.decided" && entry.userId === portalUserId
    )
  )

  console.log("multi-slot meeting verification passed")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [portalUserId, staffUserId] } } })
      .catch(() => {})
    await pool.end()
  })

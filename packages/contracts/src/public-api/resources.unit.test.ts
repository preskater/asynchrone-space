import { describe, expect, it } from "vitest"

import {
  PublicClientSchema,
  PublicDealSchema,
  PublicProjectSchema,
  publicPageResultSchema,
} from "./resources"

const project = {
  id: "p1",
  name: "Website",
  description: null,
  status: "active",
  clientId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  dueDate: null,
  startDate: null,
  endDate: null,
  plannedHours: null,
  isBillable: true,
  memberIds: ["u1"],
  labelIds: [],
}

describe("public resource schemas", () => {
  it("accepts a project and strips anything outside the public shape", () => {
    const parsed = PublicProjectSchema.parse({
      ...project,
      repositoryProvider: "github",
      oid: 12,
    })
    expect(parsed).toEqual(project)
    expect(parsed).not.toHaveProperty("repositoryProvider")
  })

  it("rejects an unknown project status", () => {
    expect(() =>
      PublicProjectSchema.parse({ ...project, status: "archived" })
    ).toThrow()
  })

  it("accepts date-only CRM close dates", () => {
    const deal = {
      id: "d1",
      name: "Renewal",
      clientId: null,
      pipelineId: null,
      stageId: null,
      stageName: null,
      stageType: null,
      amount: 1000,
      currency: "EUR",
      probability: 50,
      status: "open",
      expectedCloseDate: "2026-12-31",
      actualCloseDate: null,
      lossReason: null,
      source: null,
      description: null,
      ownerId: null,
      contactIds: [],
      archivedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }
    expect(PublicDealSchema.parse(deal).expectedCloseDate).toBe("2026-12-31")
  })

  it("wraps a resource in a page result", () => {
    const page = publicPageResultSchema(PublicClientSchema).parse({
      items: [],
      nextCursor: "abc",
    })
    expect(page).toEqual({ items: [], nextCursor: "abc" })
  })
})

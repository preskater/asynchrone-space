import { describe, expect, it } from "vitest"

import {
  PublicCreateClientSchema,
  PublicCreateContactSchema,
  PublicCreateDealSchema,
  PublicCreateProjectSchema,
  PublicCreateTaskSchema,
  PublicMoveDealSchema,
  PublicUpdateClientSchema,
  PublicUpdateProjectSchema,
  PublicUpdateTaskSchema,
} from "./mutations"

describe("public project inputs", () => {
  it("accepts a minimal project and rejects an unknown status", () => {
    expect(PublicCreateProjectSchema.parse({ name: "Website" })).toEqual({
      name: "Website",
    })
    expect(() =>
      PublicCreateProjectSchema.parse({ name: "Website", status: "archived" })
    ).toThrow()
  })

  it("requires at least one field on a patch but accepts a date alone", () => {
    expect(PublicUpdateProjectSchema.safeParse({}).success).toBe(false)
    expect(PublicUpdateProjectSchema.parse({ dueDate: "2026-12-31" })).toEqual({
      dueDate: "2026-12-31",
    })
  })
})

describe("public task inputs", () => {
  it("requires the project on create", () => {
    expect(PublicCreateTaskSchema.safeParse({ title: "Ship" }).success).toBe(
      false
    )
    expect(
      PublicCreateTaskSchema.parse({ projectId: "p1", title: "Ship" })
    ).toMatchObject({ projectId: "p1", title: "Ship" })
  })

  it("rejects an empty patch and accepts clearing the assignee", () => {
    expect(PublicUpdateTaskSchema.safeParse({}).success).toBe(false)
    expect(PublicUpdateTaskSchema.parse({ assigneeId: null })).toEqual({
      assigneeId: null,
    })
  })
})

describe("public CRM inputs", () => {
  it("validates the client email and rejects an empty patch", () => {
    expect(() =>
      PublicCreateClientSchema.parse({ name: "Acme", contactEmail: "nope" })
    ).toThrow()
    expect(PublicCreateClientSchema.parse({ name: "Acme" }).name).toBe("Acme")
    expect(PublicUpdateClientSchema.safeParse({}).success).toBe(false)
  })

  it("requires a first name on a contact", () => {
    expect(PublicCreateContactSchema.safeParse({}).success).toBe(false)
    expect(
      PublicCreateContactSchema.parse({ firstName: "Ada" }).firstName
    ).toBe("Ada")
  })

  it("accepts a date-only deal close date and validates probability", () => {
    const deal = PublicCreateDealSchema.parse({
      name: "Renewal",
      expectedCloseDate: "2026-12-31",
      probability: 60,
    })
    expect(deal.expectedCloseDate).toBe("2026-12-31")
    expect(() =>
      PublicCreateDealSchema.parse({ name: "Renewal", probability: 101 })
    ).toThrow()
  })

  it("requires a stage on move", () => {
    expect(PublicMoveDealSchema.safeParse({}).success).toBe(false)
    expect(PublicMoveDealSchema.parse({ stageId: "s1" }).stageId).toBe("s1")
  })
})

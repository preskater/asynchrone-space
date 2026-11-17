import { describe, expect, it } from "vitest"

import { pageQuery, requiredParam } from "./query"

const base = "https://asynchrone.space/api/v1/projects"

describe("pageQuery", () => {
  it("defaults to 50 rows and no cursor", () => {
    expect(pageQuery(new URL(base))).toEqual({ limit: 50, cursor: null })
  })

  it("passes a valid limit and cursor through", () => {
    expect(pageQuery(new URL(`${base}?limit=10&cursor=abc`))).toEqual({
      limit: 10,
      cursor: "abc",
    })
  })

  it("rejects a limit above the public maximum", () => {
    expect(() => pageQuery(new URL(`${base}?limit=500`))).toThrow()
  })

  it("rejects a non-positive or non-numeric limit", () => {
    expect(() => pageQuery(new URL(`${base}?limit=0`))).toThrow()
    expect(() => pageQuery(new URL(`${base}?limit=abc`))).toThrow()
  })
})

describe("requiredParam", () => {
  it("returns a present query parameter", () => {
    expect(requiredParam(new URL(`${base}?projectId=p1`), "projectId")).toBe(
      "p1"
    )
  })

  it("rejects a missing query parameter", () => {
    expect(() => requiredParam(new URL(base), "projectId")).toThrow(
      "projectId query parameter is required"
    )
  })
})

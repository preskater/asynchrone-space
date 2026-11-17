import { describe, expect, it } from "vitest"

import { DomainPageInputSchema } from "./domain"

describe("DomainPageInputSchema", () => {
  it("accepts the shared page input, including a null first-page cursor", () => {
    expect(DomainPageInputSchema.parse({ limit: 5, cursor: null })).toEqual({
      limit: 5,
      cursor: null,
    })
    expect(DomainPageInputSchema.parse({ limit: 5, cursor: "abc" })).toEqual({
      limit: 5,
      cursor: "abc",
    })
    expect(DomainPageInputSchema.parse({})).toEqual({})
  })
})

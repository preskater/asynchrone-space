import { describe, expect, it } from "vitest"

import { auditActorFields } from "./context"

describe("auditActorFields", () => {
  it("uses the member by default", () => {
    expect(auditActorFields({ userId: "user_1" })).toEqual({
      actorId: "user_1",
      actorName: undefined,
      actorEmail: undefined,
    })
  })

  it("prefers the API-token actor when one is present", () => {
    expect(
      auditActorFields({
        userId: "user_1",
        actor: {
          id: "api-token:tok_1",
          name: "CI deploy",
          email: "ada@example.com",
        },
      })
    ).toEqual({
      actorId: "api-token:tok_1",
      actorName: "CI deploy",
      actorEmail: "ada@example.com",
    })
  })
})

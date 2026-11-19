import { describe, expect, it } from "vitest"

import { readJsonBody } from "./body"

function post(body: string) {
  return new Request("http://localhost/api/v1/projects", {
    method: "POST",
    body,
  })
}

describe("readJsonBody", () => {
  it("returns the parsed body", async () => {
    await expect(readJsonBody(post('{"name":"Site"}'))).resolves.toEqual({
      name: "Site",
    })
  })

  it.each([
    '{"name":"a\\u0000b"}',
    '{"memberIds":["ok","\\u0000"]}',
    '{"nested":{"\\u0000key":1}}',
  ])("rejects a NUL character with a 422: %s", async (body) => {
    await expect(readJsonBody(post(body))).rejects.toMatchObject({
      status: 422,
      code: "validation_error",
    })
  })

  it("rejects malformed JSON with a 422", async () => {
    await expect(readJsonBody(post("{"))).rejects.toMatchObject({
      status: 422,
    })
  })
})

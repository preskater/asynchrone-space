import { describe, expect, it } from "vitest"

import { rejectCrossOrigin } from "./http"

function post(headers: Record<string, string>) {
  return new Request("http://app.test/api/files/uploads", {
    method: "POST",
    headers: { host: "app.test", ...headers },
  })
}

describe("rejectCrossOrigin", () => {
  it("allows same-origin requests", () => {
    expect(rejectCrossOrigin(post({ origin: "http://app.test" }))).toBeNull()
    expect(
      rejectCrossOrigin(
        post({ origin: "https://presk.re", "x-forwarded-host": "presk.re" })
      )
    ).toBeNull()
    expect(
      rejectCrossOrigin(post({ "sec-fetch-site": "same-origin" }))
    ).toBeNull()
  })

  it("allows non-browser clients without Origin or Sec-Fetch-Site", () => {
    expect(rejectCrossOrigin(post({}))).toBeNull()
  })

  it("rejects other origins, sibling subdomains and opaque origins", () => {
    for (const headers of <Record<string, string>[]>[
      { origin: "https://evil.com" },
      { origin: "http://evil.app.test" },
      { origin: "http://app.test:8080" },
      { origin: "null" },
      { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" },
    ]) {
      expect(rejectCrossOrigin(post(headers))?.status).toBe(403)
    }
  })
})

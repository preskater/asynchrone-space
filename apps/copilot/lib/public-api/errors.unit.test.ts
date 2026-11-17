import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { DomainClientError } from "@workspace/contracts"
import { AppError, NotFoundError } from "@workspace/core/errors"

import { PublicApiError, publicErrorResponse, toPublicApiError } from "./errors"

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("toPublicApiError", () => {
  it("keeps a gateway error unchanged", () => {
    const error = new PublicApiError("rate_limited", "slow down", {
      status: 429,
      headers: { "Retry-After": "1" },
    })
    expect(toPublicApiError(error)).toBe(error)
  })

  it("maps domain errors to their status and code", () => {
    expect(toPublicApiError(new NotFoundError("Task"))).toMatchObject({
      code: "not_found",
      status: 404,
    })
  })

  it("never exposes an internal error message", () => {
    expect(
      toPublicApiError(new AppError("internal_error", "pg: secret detail"))
    ).toMatchObject({
      code: "internal_error",
      status: 500,
      message: "Something went wrong.",
    })
  })

  it("turns a Zod error into field details", () => {
    const parsed = z.object({ name: z.string().min(1) }).safeParse({ name: "" })
    expect(parsed.success).toBe(false)
    const mapped = toPublicApiError(parsed.error)
    expect(mapped).toMatchObject({ code: "validation_error", status: 422 })
    expect(mapped.details).toMatchObject([{ path: "name" }])
  })

  it("hides upstream service failures", () => {
    expect(
      toPublicApiError(
        new DomainClientError("service_unavailable", "upstream", 503)
      )
    ).toMatchObject({ code: "internal_error", status: 502 })
  })

  it("preserves a domain 4xx decision", () => {
    expect(
      toPublicApiError(
        new DomainClientError("role_cannot_modify_projects", "nope", 403)
      )
    ).toMatchObject({ code: "role_cannot_modify_projects", status: 403 })
  })
})

describe("publicErrorResponse", () => {
  it("returns the public envelope with the request id", async () => {
    const response = publicErrorResponse(new NotFoundError("Task"), "req_1")
    expect(response.status).toBe(404)
    expect(response.headers.get("x-request-id")).toBe("req_1")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_found" },
      meta: { requestId: "req_1" },
    })
  })
})

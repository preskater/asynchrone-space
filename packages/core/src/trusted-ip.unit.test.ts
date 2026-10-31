import { describe, expect, it } from "vitest"

import {
  DEFAULT_TRUSTED_IP_HEADERS,
  parseTrustedIpHeaders,
  trustedIpHeaderProblems,
} from "./trusted-ip"

describe("parseTrustedIpHeaders", () => {
  it("defaults to the headers ingress-nginx overwrites", () => {
    expect(parseTrustedIpHeaders(undefined)).toEqual([
      ...DEFAULT_TRUSTED_IP_HEADERS,
    ])
    expect(parseTrustedIpHeaders("")).toEqual([...DEFAULT_TRUSTED_IP_HEADERS])
    expect(parseTrustedIpHeaders("  ")).toEqual([...DEFAULT_TRUSTED_IP_HEADERS])
  })

  it("normalises a custom list", () => {
    expect(
      parseTrustedIpHeaders(" X-Forwarded-For , x-real-ip ,X-FORWARDED-FOR ")
    ).toEqual(["x-forwarded-for", "x-real-ip"])
  })
})

describe("trustedIpHeaderProblems", () => {
  it("accepts the defaults and a custom list", () => {
    expect(trustedIpHeaderProblems(undefined)).toEqual([])
    expect(trustedIpHeaderProblems("x-real-ip,x-forwarded-for")).toEqual([])
  })

  it("refuses an empty list", () => {
    expect(trustedIpHeaderProblems(",")).toHaveLength(1)
  })

  it("refuses duplicate and malformed names", () => {
    expect(trustedIpHeaderProblems("x-real-ip,x-real-ip")[0]).toContain(
      "repeats"
    )
    expect(trustedIpHeaderProblems("x real ip")[0]).toContain("invalid")
  })
})

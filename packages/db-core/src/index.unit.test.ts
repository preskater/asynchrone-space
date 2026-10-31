import { describe, expect, it } from "vitest"

import { createPool, poolMax } from "./index"

describe("database pool", () => {
  it("defaults to three connections", () => {
    expect(poolMax(undefined)).toBe(3)
    expect(poolMax("")).toBe(3)
    expect(poolMax("0")).toBe(3)
    expect(poolMax("not-a-number")).toBe(3)
  })

  it("accepts a positive budget", () => {
    expect(poolMax("7")).toBe(7)
    expect(poolMax("0.5")).toBe(3)
  })

  it("requires a connection string", () => {
    expect(() =>
      createPool(undefined, { label: "PROJECTS_DATABASE_URL" })
    ).toThrow("PROJECTS_DATABASE_URL is required")
  })

  it("builds a pool with the configured budget", async () => {
    const pool = createPool("postgresql://user:pass@localhost:5432/db", {
      max: 2,
    })
    expect(pool.options.max).toBe(2)
    await pool.end()
  })
})

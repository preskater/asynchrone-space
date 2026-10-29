import { afterEach, describe, expect, it } from "vitest"

import { teamTrialDays } from "./stripe-provider"
import { TEAM_TRIAL_DAYS } from "./types"

const original = process.env.STRIPE_TEAM_TRIAL_DAYS

afterEach(() => {
  if (original === undefined) {
    delete process.env.STRIPE_TEAM_TRIAL_DAYS
  } else {
    process.env.STRIPE_TEAM_TRIAL_DAYS = original
  }
})

describe("teamTrialDays", () => {
  it("defaults to the catalog trial when unset or blank", () => {
    delete process.env.STRIPE_TEAM_TRIAL_DAYS
    expect(teamTrialDays()).toBe(TEAM_TRIAL_DAYS)

    process.env.STRIPE_TEAM_TRIAL_DAYS = ""
    expect(teamTrialDays()).toBe(TEAM_TRIAL_DAYS)
  })

  it("returns 0 so checkout charges immediately", () => {
    process.env.STRIPE_TEAM_TRIAL_DAYS = "0"
    expect(teamTrialDays()).toBe(0)
  })

  it("honours a custom length", () => {
    process.env.STRIPE_TEAM_TRIAL_DAYS = "7"
    expect(teamTrialDays()).toBe(7)
  })

  it("falls back to the default for invalid input", () => {
    for (const value of ["abc", "-3"]) {
      process.env.STRIPE_TEAM_TRIAL_DAYS = value
      expect(teamTrialDays()).toBe(TEAM_TRIAL_DAYS)
    }
  })
})

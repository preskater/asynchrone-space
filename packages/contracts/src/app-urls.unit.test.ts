import { afterEach, describe, expect, it, vi } from "vitest"

import {
  allAppOrigins,
  appOAuthResources,
  appOAuthScopes,
  appOrigin,
  appUrl,
  trustedCustomerOrigins,
  workspaceOrigin,
} from "./app-urls.server"
import { APP_USER_SCOPES } from "./oauth"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("app origins", () => {
  it("falls back to the development port", () => {
    expect(appOrigin("projects")).toBe("http://localhost:3004")
  })

  it("uses the environment variable and trims a trailing slash", () => {
    vi.stubEnv("PROJECTS_APP_URL", "https://projects.copilot.asynchrone.space/")
    expect(appOrigin("projects")).toBe(
      "https://projects.copilot.asynchrone.space"
    )
  })

  it("builds locale, organization and path segments", () => {
    vi.stubEnv("COPILOT_APP_URL", "https://copilot.asynchrone.space")
    expect(
      appUrl("copilot", { locale: "fr", orgSlug: "acme", path: "/settings" })
    ).toBe("https://copilot.asynchrone.space/fr/acme/settings")
    expect(appUrl("copilot", { locale: "en", orgSlug: "acme" })).toBe(
      "https://copilot.asynchrone.space/en/acme"
    )
    expect(appUrl("landing", { path: "/pricing" })).toBe(
      "http://localhost:3002/pricing"
    )
  })

  it("rejects a relative path without a leading slash", () => {
    expect(() => appUrl("copilot", { path: "settings" })).toThrow(
      "appUrl path must start with /"
    )
  })

  it("trusts customer apps but not the landing or control tower", () => {
    vi.stubEnv("COPILOT_APP_URL", "https://copilot.asynchrone.space")
    vi.stubEnv("PROJECTS_APP_URL", "https://projects.copilot.asynchrone.space")
    vi.stubEnv("LANDING_APP_URL", "https://asynchrone.space")
    vi.stubEnv(
      "CONTROL_TOWER_APP_URL",
      "https://control-tower.asynchrone.space"
    )

    expect(trustedCustomerOrigins()).toContain(
      "https://projects.copilot.asynchrone.space"
    )
    expect(trustedCustomerOrigins()).not.toContain("https://asynchrone.space")
    expect(trustedCustomerOrigins()).not.toContain(
      "https://control-tower.asynchrone.space"
    )
    expect(workspaceOrigin()).toBe("https://copilot.asynchrone.space")
  })

  it("returns every configured origin", () => {
    const origins = allAppOrigins()
    expect(origins.landing).toBe("http://localhost:3002")
    expect(origins["control-tower"]).toBe("http://localhost:3001")
  })
})

describe("OAuth resources", () => {
  it("targets the six domain apps, not Copilot or the landing", () => {
    const resources = appOAuthResources()
    expect(resources.map((resource) => resource.identifier)).toEqual([
      "urn:asynchrone:app:projects",
      "urn:asynchrone:app:calendars",
      "urn:asynchrone:app:files",
      "urn:asynchrone:app:messages",
      "urn:asynchrone:app:clients",
      "urn:asynchrone:app:employees",
    ])
    expect(
      resources.every((resource) => resource.allowedScopes.includes("app:read"))
    ).toBe(true)
  })

  it("uses the same user scopes for every app", () => {
    expect(appOAuthScopes()).toEqual([...APP_USER_SCOPES])
    expect(appOAuthScopes()).toContain("offline_access")
  })
})

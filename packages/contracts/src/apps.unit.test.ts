import { describe, expect, it } from "vitest"

import {
  APP_KEYS,
  APPS,
  CUSTOMER_APP_KEYS,
  databaseName,
  internalAudience,
  isAppKey,
  oauthClient,
} from "./apps"

describe("app registry", () => {
  it("defines one entry for every app key", () => {
    for (const key of APP_KEYS) {
      expect(APPS[key].key).toBe(key)
      expect(APPS[key].hostEnv).toMatch(/_APP_URL$/)
      expect(APPS[key].devUrl).toMatch(/^http:\/\/localhost:\d+$/)
      expect(APPS[key].internalAudience).toBe(`urn:asynchrone:app:${key}`)
    }
  })

  it("gives every stateful app its own database", () => {
    const databases = APP_KEYS.map(databaseName).filter(
      (name): name is string => name !== null
    )
    expect(new Set(databases).size).toBe(databases.length)
    expect(databaseName("landing")).toBeNull()
    expect(databaseName("copilot")).toBe("asynchrone_identity")
    expect(databaseName("projects")).toBe("asynchrone_projects")
    expect(databaseName("control-tower")).toBe("asynchrone_control_tower")
  })

  it("keeps the landing and control tower out of the customer app list", () => {
    expect(CUSTOMER_APP_KEYS).not.toContain("landing")
    expect(CUSTOMER_APP_KEYS).not.toContain("control-tower")
    expect(CUSTOMER_APP_KEYS).toContain("copilot")
  })

  it("derives OAuth client env vars from the app key", () => {
    expect(oauthClient("projects")).toEqual({
      clientIdEnv: "PROJECTS_OAUTH_CLIENT_ID",
      clientSecretEnv: "PROJECTS_OAUTH_CLIENT_SECRET",
    })
    expect(oauthClient("control-tower")?.clientIdEnv).toBe(
      "CONTROL_TOWER_OAUTH_CLIENT_ID"
    )
    expect(oauthClient("landing")).toBeNull()
  })

  it("recognises only known app keys", () => {
    expect(isAppKey("projects")).toBe(true)
    expect(isAppKey("portal")).toBe(false)
    expect(internalAudience("files")).toBe("urn:asynchrone:app:files")
  })
})

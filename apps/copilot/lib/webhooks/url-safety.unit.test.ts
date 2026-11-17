import { describe, expect, it } from "vitest"

import { assertSafeWebhookUrl, isPrivateAddress } from "./url-safety"

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }]
const privateResolver = async () => [{ address: "10.0.0.5", family: 4 }]

describe("assertSafeWebhookUrl", () => {
  it("accepts an HTTPS URL that resolves to a public address", async () => {
    const url = await assertSafeWebhookUrl(
      "https://example.com/hooks/presk",
      publicResolver
    )
    expect(url.hostname).toBe("example.com")
  })

  it("rejects plain HTTP", async () => {
    await expect(
      assertSafeWebhookUrl("http://example.com/hook", publicResolver)
    ).rejects.toMatchObject({ code: "validation_error" })
  })

  it("rejects embedded credentials and fragments", async () => {
    await expect(
      assertSafeWebhookUrl("https://user:pass@example.com/hook", publicResolver)
    ).rejects.toThrow()
    await expect(
      assertSafeWebhookUrl("https://example.com/hook#fragment", publicResolver)
    ).rejects.toThrow()
  })

  it("rejects local hosts", async () => {
    await expect(
      assertSafeWebhookUrl("https://localhost/hook", publicResolver)
    ).rejects.toThrow()
    await expect(
      assertSafeWebhookUrl("https://service.local/hook", publicResolver)
    ).rejects.toThrow()
  })

  it("rejects private IPv4 and IPv6 literals without resolving them", async () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "[::1]",
      "[fd00::1]",
      "[fe80::1]",
    ]) {
      await expect(
        assertSafeWebhookUrl(`https://${address}/hook`, publicResolver)
      ).rejects.toThrow()
    }
  })

  it("accepts a public IP literal", async () => {
    await expect(
      assertSafeWebhookUrl("https://8.8.8.8/hook", publicResolver)
    ).resolves.toBeInstanceOf(URL)
  })

  it("rejects a host that resolves to a private address", async () => {
    await expect(
      assertSafeWebhookUrl("https://example.com/hook", privateResolver)
    ).rejects.toThrow()
  })

  it("rejects an unresolvable host", async () => {
    await expect(
      assertSafeWebhookUrl("https://example.com/hook", async () => {
        throw new Error("ENOTFOUND")
      })
    ).rejects.toThrow()
  })
})

describe("isPrivateAddress", () => {
  it("classifies private and public addresses", () => {
    expect(isPrivateAddress("10.0.0.1")).toBe(true)
    expect(isPrivateAddress("192.168.1.1")).toBe(true)
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true)
    expect(isPrivateAddress("fd00::1")).toBe(true)
    expect(isPrivateAddress("2001:4860:4860::8888")).toBe(false)
    expect(isPrivateAddress("8.8.8.8")).toBe(false)
  })
})

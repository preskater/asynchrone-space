import { expect, test } from "@playwright/test"

import { signUp } from "./fixtures"

test("the last owner cannot remove themselves", async ({ page }) => {
  await signUp(page)

  const session = await page.request.get("/api/auth/get-session")
  const userId = (await session.json()).user.id as string

  const res = await page.request.delete(`/api/members/${userId}`)
  expect(res.status()).toBe(403)
})

test("a user cannot read another organization's project", async ({ browser }) => {
  const contextA = await browser.newContext()
  const pageA = await contextA.newPage()
  await signUp(pageA)

  const created = await pageA.request.post("/api/projects", {
    data: { name: "Owner A private project" },
  })
  expect(created.ok(), await created.text()).toBeTruthy()
  const project = (await created.json()) as { id: string }

  const contextB = await browser.newContext()
  const pageB = await contextB.newPage()
  await signUp(pageB)

  const res = await pageB.request.get(`/api/projects/${project.id}`)
  expect([403, 404]).toContain(res.status())

  await contextA.close()
  await contextB.close()
})

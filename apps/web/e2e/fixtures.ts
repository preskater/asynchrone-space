import { expect, type Page } from "@playwright/test"

export function uniqueEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`
}

/**
 * Create a fresh account through the Better Auth API (registration is open)
 * and an organization, returning the organization slug. Uses `page.request`
 * so the session cookies are shared with the browser context.
 */
export async function signUp(page: Page): Promise<string> {
  const email = uniqueEmail()
  const password = "Password123!"
  const name = "E2E User"

  const signUpRes = await page.request.post("/api/auth/sign-up/email", {
    data: { email, password, name },
  })
  expect(signUpRes.ok(), await signUpRes.text()).toBeTruthy()

  const slug = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const orgRes = await page.request.post("/api/auth/organization/create", {
    data: { name: `E2E Org ${slug}`, slug },
  })
  expect(orgRes.ok(), await orgRes.text()).toBeTruthy()

  return slug
}

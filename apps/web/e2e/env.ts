/**
 * Shared by `playwright.config.ts` and the specs.
 *
 * The shell and the domain apps run on different local ports; cookies are
 * shared across `localhost` ports, so one sign-up authenticates all of them.
 */

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3020)
export const PROJECTS_E2E_PORT = Number(process.env.PROJECTS_E2E_PORT ?? 3021)
export const FILES_E2E_PORT = Number(process.env.FILES_E2E_PORT ?? 3022)

export const E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`
export const PROJECTS_E2E_URL =
  process.env.PROJECTS_E2E_URL ?? `http://localhost:${PROJECTS_E2E_PORT}`
export const FILES_E2E_URL =
  process.env.FILES_E2E_URL ?? `http://localhost:${FILES_E2E_PORT}`

import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "@playwright/test"

import {
  E2E_BASE_URL,
  E2E_PORT,
  FILES_E2E_PORT,
  FILES_E2E_URL,
  PROJECTS_E2E_PORT,
  PROJECTS_E2E_URL,
} from "./e2e/env"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const workspaceRoot = path.join(projectRoot, "../..")
const sharedEnv = {
  BETTER_AUTH_URL: E2E_BASE_URL,
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? "e2e-placeholder-secret-at-least-16",
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://preskater:preskater@localhost:5434/preskater?schema=public",
  PROJECTS_APP_URL: PROJECTS_E2E_URL,
  CALENDARS_APP_URL: process.env.CALENDARS_APP_URL ?? "http://localhost:3004",
  FILES_APP_URL: FILES_E2E_URL,
  MESSAGES_APP_URL: process.env.MESSAGES_APP_URL ?? "http://localhost:3006",
  CRM_APP_URL: process.env.CRM_APP_URL ?? "http://localhost:3007",
  HR_APP_URL: process.env.HR_APP_URL ?? "http://localhost:3008",
  PORTAL_APP_URL: process.env.PORTAL_APP_URL ?? "http://localhost:3009",
  COPILOT_APP_URL: process.env.COPILOT_APP_URL ?? "http://localhost:3010",
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: `npm run dev -- --port ${E2E_PORT}`,
          url: E2E_BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: sharedEnv,
        },
        {
          command: `npx next dev --port ${PROJECTS_E2E_PORT}`,
          cwd: path.join(workspaceRoot, "apps/projects"),
          url: `${PROJECTS_E2E_URL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: sharedEnv,
        },
        {
          command: `npx next dev --port ${FILES_E2E_PORT}`,
          cwd: path.join(workspaceRoot, "apps/files"),
          url: `${FILES_E2E_URL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: sharedEnv,
        },
      ],
})

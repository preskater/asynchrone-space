import path from "node:path"
import { fileURLToPath } from "node:url"

import { config as loadEnv } from "dotenv"
import { defineConfig } from "prisma/config"

const here = path.dirname(fileURLToPath(import.meta.url))

loadEnv({
  path: [path.resolve(here, "../../apps/web/.env"), path.resolve(here, ".env")],
  quiet: true,
})

const url = process.env.CALENDARS_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) throw new Error("CALENDARS_DATABASE_URL or DATABASE_URL is required")

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url },
})

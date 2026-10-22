import { config } from "@workspace/eslint-config/base"

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  // Generated Prisma client and SQL migrations are not hand-written.
  { ignores: ["lib/generated/**", "prisma/migrations/**"] },
]

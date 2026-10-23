import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    // Unit tests do not connect to a database, but importing a service pulls
    // in the shared env validation. Provide non-connecting placeholders.
    env: {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
      BETTER_AUTH_SECRET: "unit-test-secret-at-least-16-chars",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
    include: ["**/*.unit.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
})

import { resolveWorkspace as resolve } from "@workspace/app-shell/server"

export function resolveWorkspace(orgSlug: string, locale: string) {
  return resolve(orgSlug, locale, { appKey: "copilot" })
}

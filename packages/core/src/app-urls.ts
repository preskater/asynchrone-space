/**
 * Customer app registry.
 *
 * Every app keeps the `/{locale}/{orgSlug}/...` path shape; only the origin
 * changes. Links between apps must go through this module so a host change is a
 * one-line edit and local development uses explicit ports.
 *
 * Hosts are read from the server environment and passed to client components as
 * props (or as the `apps` value below). Do not replace these with
 * `NEXT_PUBLIC_*` variables: they would be baked into the image and prevent one
 * build from serving several environments.
 */

export const APP_KEYS = [
  "web",
  "projects",
  "calendars",
  "files",
  "messages",
  "clients",
  "employees",
  "portal",
  "copilot",
] as const

export type AppKey = (typeof APP_KEYS)[number]

export interface AppDefinition {
  key: AppKey
  /** Translation key used by the shared app switcher/sidebar. */
  titleKey: string
  /** Environment variable holding the public origin. */
  envVar: string
  /** Development fallback (each app runs on its own port). */
  devUrl: string
}

export const APPS: Record<AppKey, AppDefinition> = {
  web: {
    key: "web",
    titleKey: "workspace",
    envVar: "BETTER_AUTH_URL",
    devUrl: "http://localhost:3000",
  },
  projects: {
    key: "projects",
    titleKey: "projects",
    envVar: "PROJECTS_APP_URL",
    devUrl: "http://localhost:3003",
  },
  calendars: {
    key: "calendars",
    titleKey: "calendars",
    envVar: "CALENDARS_APP_URL",
    devUrl: "http://localhost:3004",
  },
  files: {
    key: "files",
    titleKey: "files",
    envVar: "FILES_APP_URL",
    devUrl: "http://localhost:3005",
  },
  messages: {
    key: "messages",
    titleKey: "messages",
    envVar: "MESSAGES_APP_URL",
    devUrl: "http://localhost:3006",
  },
  clients: {
    key: "clients",
    titleKey: "clients",
    envVar: "CLIENTS_APP_URL",
    devUrl: "http://localhost:3007",
  },
  employees: {
    key: "employees",
    titleKey: "employees",
    envVar: "EMPLOYEES_APP_URL",
    devUrl: "http://localhost:3008",
  },
  portal: {
    key: "portal",
    titleKey: "portal",
    envVar: "PORTAL_APP_URL",
    devUrl: "http://localhost:3009",
  },
  copilot: {
    key: "copilot",
    titleKey: "assistant",
    envVar: "COPILOT_APP_URL",
    devUrl: "http://localhost:3010",
  },
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "")
}

/** Public origin of an app, e.g. `https://projects.presk.re`. */
export function appOrigin(key: AppKey): string {
  const definition = APPS[key]
  return trimTrailingSlash(
    process.env[definition.envVar] || definition.devUrl
  )
}

/**
 * Absolute URL to a page in another app. `locale` and `orgSlug` are optional so
 * the same helper can build marketing/auth links.
 */
export function appUrl(
  key: AppKey,
  options: {
    locale?: string
    orgSlug?: string
    path?: string
  } = {}
): string {
  const segments: string[] = []
  if (options.locale) segments.push(options.locale)
  if (options.orgSlug) segments.push(options.orgSlug)
  if (options.path) segments.push(options.path.replace(/^\/+/, ""))
  const suffix = segments.length > 0 ? `/${segments.join("/")}` : ""
  return `${appOrigin(key)}${suffix}`
}

/**
 * Origins Better Auth trusts for redirects and CSRF checks. Explicit hosts are
 * safer than a wildcard and match the deployment's app registry.
 */
export function trustedAppOrigins(): string[] {
  return Array.from(
    new Set(
      APP_KEYS.map((key) => appOrigin(key)).filter((origin) =>
        /^https?:\/\//.test(origin)
      )
    )
  )
}

/**
 * Parent domain for the shared customer session. Unset in local development
 * (cookies already span ports on localhost) and `.presk.re`-style in production.
 * The control tower never reads this variable.
 */
export function authCookieDomain(): string | undefined {
  const value = process.env.AUTH_COOKIE_DOMAIN?.trim()
  return value ? value : undefined
}

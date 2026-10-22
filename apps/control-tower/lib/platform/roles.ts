export const PLATFORM_ROLES = ["platform_admin", "platform_support"] as const

export type PlatformRole = (typeof PLATFORM_ROLES)[number]

export const PLATFORM_ADMIN: PlatformRole = "platform_admin"

/** Parses the comma-separated `user.role` field, keeping platform roles only. */
export function parsePlatformRoles(
  role: string | null | undefined
): PlatformRole[] {
  return (role ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is PlatformRole =>
      (PLATFORM_ROLES as readonly string[]).includes(value)
    )
}

export function primaryPlatformRole(
  role: string | null | undefined
): PlatformRole | null {
  return parsePlatformRoles(role)[0] ?? null
}

export function isPlatformAdmin(role: PlatformRole): boolean {
  return role === PLATFORM_ADMIN
}

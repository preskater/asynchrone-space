/**
 * Customer auth server surface.
 *
 * `apps/web` mounts the Better Auth routes; every other customer app imports
 * this module only to read the shared session and resolve its organization.
 * See ADR 0021.
 */
export { auth } from "./auth"
export * from "./context"
export * from "./paths"

export * from "./workspace"

import { PortalService } from "./service"

export const portalService = new PortalService()

export { PortalService }
export { getPortalContext, isPortalMember } from "./context"
export type { PortalContext } from "./context"
export * from "./schemas"
export * from "./types"

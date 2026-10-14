/** One project of the client's company, with its task progress. */
export interface PortalProjectSummary {
  id: string
  name: string
  status: string
  dueDate?: string
  doneTasks: number
  totalTasks: number
}

/** A client-visible document shared with the company. */
export interface PortalDocumentData {
  id: string
  fileId: string
  name: string
  sizeBytes?: number
  createdAt: string
}

export interface PortalDashboardData {
  organizationName: string
  clientName: string
  projects: PortalProjectSummary[]
  documents: PortalDocumentData[]
}

/** A task of a client project (titles, status and deadlines only). */
export interface PortalTaskData {
  id: string
  title: string
  status: string
  dueDate?: string
}

export interface PortalProjectDetailData {
  id: string
  name: string
  description?: string
  status: string
  dueDate?: string
  createdAt: string
  tasks: PortalTaskData[]
}

/** A portal user of a company (internal view). */
export interface PortalMemberData {
  memberId: string
  userId: string
  name: string
  email: string
  createdAt: string
}

/** A pending portal invitation of a company (internal view). */
export interface PortalInviteData {
  id: string
  email: string
  name?: string
  createdAt: string
  invitationId?: string
}

export interface PortalAccessData {
  members: PortalMemberData[]
  invites: PortalInviteData[]
}

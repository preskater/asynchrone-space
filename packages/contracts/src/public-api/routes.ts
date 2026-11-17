import type { z } from "zod"

import {
  PublicCreateClientSchema,
  PublicCreateContactSchema,
  PublicCreateDealSchema,
  PublicCreateProjectSchema,
  PublicCreateTaskSchema,
  PublicMoveDealSchema,
  PublicUpdateClientSchema,
  PublicUpdateContactSchema,
  PublicUpdateDealSchema,
  PublicUpdateProjectSchema,
  PublicUpdateTaskSchema,
} from "./mutations"
import {
  PublicApiPageQuerySchema,
  PublicApiMeSchema,
  PublicApiTokenInfoSchema,
  PublicApiMemberSchema,
  PublicApiErrorSchema,
  PublicDeleteResultSchema,
} from "./schemas"
import type { PublicApiScope } from "./scopes"
import { PUBLIC_API_SCOPES } from "./scopes"
import {
  PublicClientSchema,
  PublicContactSchema,
  PublicDealSchema,
  PublicEmployeeSchema,
  PublicFileSchema,
  PublicFilesQuerySchema,
  PublicProjectSchema,
  PublicTaskSchema,
  PublicTasksQuerySchema,
} from "./resources"

/** Every response component, generated from its Zod schema. */
export const PUBLIC_API_COMPONENTS = {
  Me: PublicApiMeSchema,
  TokenInfo: PublicApiTokenInfoSchema,
  Member: PublicApiMemberSchema,
  Project: PublicProjectSchema,
  Task: PublicTaskSchema,
  Client: PublicClientSchema,
  Contact: PublicContactSchema,
  Deal: PublicDealSchema,
  Employee: PublicEmployeeSchema,
  File: PublicFileSchema,
  DeleteResult: PublicDeleteResultSchema,
  Error: PublicApiErrorSchema,
} as const

export type PublicApiComponent = keyof typeof PUBLIC_API_COMPONENTS

export type PublicApiResponse =
  | { kind: "item"; component: PublicApiComponent }
  | { kind: "list"; component: PublicApiComponent }
  | { kind: "delete" }

export interface PublicApiRoute {
  method: "GET" | "POST" | "PATCH" | "DELETE"
  /** OpenAPI path, including the `/api/v1` prefix and `{param}` templates. */
  path: string
  operationId: string
  summary: string
  description?: string
  tag: string
  /** Omitted for `/me`, which only requires a valid token. */
  scope?: PublicApiScope
  query?: z.ZodType
  body?: z.ZodType
  response: PublicApiResponse
  /** Default 200; creates use 201. */
  status?: number
}

export const PUBLIC_API_TAGS = [
  { name: "Account", description: "Token and organization identity." },
  { name: "Members", description: "The workspace member directory." },
  { name: "Projects", description: "Projects and their settings." },
  { name: "Tasks", description: "Tasks inside a project." },
  { name: "Clients", description: "CRM companies." },
  { name: "Contacts", description: "People at client companies." },
  { name: "Deals", description: "Sales opportunities and pipelines." },
  {
    name: "Employees",
    description: "Employee profiles and capacity settings.",
  },
  { name: "Files", description: "File and folder metadata." },
] as const

const page = { query: PublicApiPageQuerySchema }
const item = (component: PublicApiComponent): PublicApiResponse => ({
  kind: "item",
  component,
})
const list = (component: PublicApiComponent): PublicApiResponse => ({
  kind: "list",
  component,
})
const deleted: PublicApiResponse = { kind: "delete" }

export const PUBLIC_API_ROUTES: readonly PublicApiRoute[] = [
  {
    method: "GET",
    path: "/api/v1/me",
    operationId: "getMe",
    summary: "Get the current token, organization and limits",
    tag: "Account",
    response: item("Me"),
  },
  {
    method: "GET",
    path: "/api/v1/token",
    operationId: "getTokenInfo",
    summary: "Get the calling token, its owner and organization",
    tag: "Account",
    response: item("TokenInfo"),
  },
  {
    method: "GET",
    path: "/api/v1/members",
    operationId: "listMembers",
    summary: "List workspace members for task assignees",
    tag: "Members",
    scope: PUBLIC_API_SCOPES.membersRead,
    response: list("Member"),
  },

  // Projects
  {
    method: "GET",
    path: "/api/v1/projects",
    operationId: "listProjects",
    summary: "List projects",
    tag: "Projects",
    scope: PUBLIC_API_SCOPES.projectsRead,
    query: page.query,
    response: list("Project"),
  },
  {
    method: "POST",
    path: "/api/v1/projects",
    operationId: "createProject",
    summary: "Create a project",
    tag: "Projects",
    scope: PUBLIC_API_SCOPES.projectsWrite,
    body: PublicCreateProjectSchema,
    response: item("Project"),
    status: 201,
  },
  {
    method: "GET",
    path: "/api/v1/projects/{projectId}",
    operationId: "getProject",
    summary: "Get a project",
    tag: "Projects",
    scope: PUBLIC_API_SCOPES.projectsRead,
    response: item("Project"),
  },
  {
    method: "PATCH",
    path: "/api/v1/projects/{projectId}",
    operationId: "updateProject",
    summary: "Update a project",
    description: "Send only the fields to change; at least one is required.",
    tag: "Projects",
    scope: PUBLIC_API_SCOPES.projectsWrite,
    body: PublicUpdateProjectSchema,
    response: item("Project"),
  },
  {
    method: "DELETE",
    path: "/api/v1/projects/{projectId}",
    operationId: "deleteProject",
    summary: "Delete a project",
    tag: "Projects",
    scope: PUBLIC_API_SCOPES.projectsWrite,
    response: deleted,
  },

  // Tasks
  {
    method: "GET",
    path: "/api/v1/tasks",
    operationId: "listTasks",
    summary: "List tasks of a project",
    tag: "Tasks",
    scope: PUBLIC_API_SCOPES.tasksRead,
    query: PublicTasksQuerySchema,
    response: list("Task"),
  },
  {
    method: "POST",
    path: "/api/v1/tasks",
    operationId: "createTask",
    summary: "Create a task",
    tag: "Tasks",
    scope: PUBLIC_API_SCOPES.tasksWrite,
    body: PublicCreateTaskSchema,
    response: item("Task"),
    status: 201,
  },
  {
    method: "GET",
    path: "/api/v1/tasks/{taskId}",
    operationId: "getTask",
    summary: "Get a task",
    tag: "Tasks",
    scope: PUBLIC_API_SCOPES.tasksRead,
    response: item("Task"),
  },
  {
    method: "PATCH",
    path: "/api/v1/tasks/{taskId}",
    operationId: "updateTask",
    summary: "Update a task",
    description: "Send only the fields to change; at least one is required.",
    tag: "Tasks",
    scope: PUBLIC_API_SCOPES.tasksWrite,
    body: PublicUpdateTaskSchema,
    response: item("Task"),
  },
  {
    method: "DELETE",
    path: "/api/v1/tasks/{taskId}",
    operationId: "deleteTask",
    summary: "Delete a task",
    tag: "Tasks",
    scope: PUBLIC_API_SCOPES.tasksWrite,
    response: deleted,
  },

  // Clients
  {
    method: "GET",
    path: "/api/v1/clients",
    operationId: "listClients",
    summary: "List clients",
    tag: "Clients",
    scope: PUBLIC_API_SCOPES.clientsRead,
    query: page.query,
    response: list("Client"),
  },
  {
    method: "POST",
    path: "/api/v1/clients",
    operationId: "createClient",
    summary: "Create a client",
    tag: "Clients",
    scope: PUBLIC_API_SCOPES.clientsWrite,
    body: PublicCreateClientSchema,
    response: item("Client"),
    status: 201,
  },
  {
    method: "GET",
    path: "/api/v1/clients/{clientId}",
    operationId: "getClient",
    summary: "Get a client",
    tag: "Clients",
    scope: PUBLIC_API_SCOPES.clientsRead,
    response: item("Client"),
  },
  {
    method: "PATCH",
    path: "/api/v1/clients/{clientId}",
    operationId: "updateClient",
    summary: "Update a client",
    description: "Send only the fields to change; at least one is required.",
    tag: "Clients",
    scope: PUBLIC_API_SCOPES.clientsWrite,
    body: PublicUpdateClientSchema,
    response: item("Client"),
  },

  // Contacts
  {
    method: "GET",
    path: "/api/v1/contacts",
    operationId: "listContacts",
    summary: "List contacts",
    tag: "Contacts",
    scope: PUBLIC_API_SCOPES.clientsRead,
    query: page.query,
    response: list("Contact"),
  },
  {
    method: "POST",
    path: "/api/v1/contacts",
    operationId: "createContact",
    summary: "Create a contact",
    tag: "Contacts",
    scope: PUBLIC_API_SCOPES.clientsWrite,
    body: PublicCreateContactSchema,
    response: item("Contact"),
    status: 201,
  },
  {
    method: "GET",
    path: "/api/v1/contacts/{contactId}",
    operationId: "getContact",
    summary: "Get a contact",
    tag: "Contacts",
    scope: PUBLIC_API_SCOPES.clientsRead,
    response: item("Contact"),
  },
  {
    method: "PATCH",
    path: "/api/v1/contacts/{contactId}",
    operationId: "updateContact",
    summary: "Update a contact",
    description: "Send only the fields to change; at least one is required.",
    tag: "Contacts",
    scope: PUBLIC_API_SCOPES.clientsWrite,
    body: PublicUpdateContactSchema,
    response: item("Contact"),
  },

  // Deals
  {
    method: "GET",
    path: "/api/v1/deals",
    operationId: "listDeals",
    summary: "List deals",
    tag: "Deals",
    scope: PUBLIC_API_SCOPES.clientsRead,
    query: page.query,
    response: list("Deal"),
  },
  {
    method: "POST",
    path: "/api/v1/deals",
    operationId: "createDeal",
    summary: "Create a deal",
    tag: "Deals",
    scope: PUBLIC_API_SCOPES.clientsWrite,
    body: PublicCreateDealSchema,
    response: item("Deal"),
    status: 201,
  },
  {
    method: "GET",
    path: "/api/v1/deals/{dealId}",
    operationId: "getDeal",
    summary: "Get a deal",
    tag: "Deals",
    scope: PUBLIC_API_SCOPES.clientsRead,
    response: item("Deal"),
  },
  {
    method: "PATCH",
    path: "/api/v1/deals/{dealId}",
    operationId: "updateDeal",
    summary: "Update a deal",
    description: "Send only the fields to change; at least one is required.",
    tag: "Deals",
    scope: PUBLIC_API_SCOPES.clientsWrite,
    body: PublicUpdateDealSchema,
    response: item("Deal"),
  },
  {
    method: "POST",
    path: "/api/v1/deals/{dealId}/move",
    operationId: "moveDeal",
    summary: "Move a deal to another pipeline stage",
    tag: "Deals",
    scope: PUBLIC_API_SCOPES.clientsWrite,
    body: PublicMoveDealSchema,
    response: item("Deal"),
  },

  // Employees
  {
    method: "GET",
    path: "/api/v1/employees",
    operationId: "listEmployees",
    summary: "List employees",
    tag: "Employees",
    scope: PUBLIC_API_SCOPES.employeesRead,
    query: page.query,
    response: list("Employee"),
  },
  {
    method: "GET",
    path: "/api/v1/employees/{userId}",
    operationId: "getEmployee",
    summary: "Get an employee",
    tag: "Employees",
    scope: PUBLIC_API_SCOPES.employeesRead,
    response: item("Employee"),
  },

  // Files
  {
    method: "GET",
    path: "/api/v1/files",
    operationId: "listFiles",
    summary: "List file and folder metadata",
    tag: "Files",
    scope: PUBLIC_API_SCOPES.filesRead,
    query: PublicFilesQuerySchema,
    response: list("File"),
  },
  {
    method: "GET",
    path: "/api/v1/files/{fileId}",
    operationId: "getFile",
    summary: "Get file metadata",
    tag: "Files",
    scope: PUBLIC_API_SCOPES.filesRead,
    response: item("File"),
  },
]

import type { SagaClient } from "@workspace/contracts"
import { describe, expect, it, vi } from "vitest"

import {
  canMarkExportReady,
  createOrganizationDeletionHandler,
  createOrganizationExportHandler,
  runOrganizationDeletionSaga,
  runUserDeletionSaga,
  type DeletionSagaStore,
  type SagaAppState,
  type SagaJobState,
  type SagaStatus,
} from "./index"

function store(initial: SagaJobState): DeletionSagaStore & {
  identityDeleted: string[]
} {
  const job = initial
  const identityDeleted: string[] = []
  return {
    identityDeleted,
    ensureOrganizationJob: async () => job,
    markOrganizationApp: async ({ app, status }) => {
      const current = job.apps.find((candidate) => candidate.app === app)
      if (current) current.status = status
    },
    markOrganizationJob: async ({ status }) => {
      job.status = status
    },
    deleteOrganizationIdentity: async (organizationId) => {
      identityDeleted.push(organizationId)
    },
    ensureUserJob: async () => job,
    markUserApp: async ({ app, status }) => {
      const current = job.apps.find((candidate) => candidate.app === app)
      if (current) current.status = status
    },
    markUserJob: async ({ status }) => {
      job.status = status
    },
    deleteUserIdentity: async (userId) => {
      identityDeleted.push(userId)
    },
  }
}

function client(
  overrides: Partial<SagaClient> = {}
): Pick<SagaClient, "deleteOrganization"> & Pick<SagaClient, "deleteUser"> {
  return {
    deleteOrganization: vi.fn(async (organizationId: string) => ({
      app: "projects",
      organizationId,
      deleted: {},
      completedAt: new Date(),
    })),
    deleteUser: vi.fn(async (userId: string) => ({
      app: "projects",
      organizationId: "org_1",
      userId,
      deleted: {},
      completedAt: new Date(),
    })),
    ...overrides,
  }
}

describe("deletion saga", () => {
  it("resumes at the failed app and deletes identity last", async () => {
    const projects = client()
    const files = client({
      deleteOrganization: vi
        .fn()
        .mockRejectedValueOnce(new Error("files unavailable"))
        .mockResolvedValue({
          app: "files",
          organizationId: "org_1",
          deleted: {},
          completedAt: new Date(),
        }),
    })
    const sagaStore = store({
      id: "job_1",
      status: "pending",
      apps: [
        { app: "projects", status: "pending" },
        { app: "files", status: "pending" },
      ],
    })

    const first = await runOrganizationDeletionSaga({
      organizationId: "org_1",
      apps: ["projects", "files"],
      clients: { projects, files },
      store: sagaStore,
    })
    expect(first.status).toBe("partial")
    expect(first.failedApps).toEqual(["files"])
    expect(sagaStore.identityDeleted).toEqual([])

    const second = await runOrganizationDeletionSaga({
      organizationId: "org_1",
      apps: ["projects", "files"],
      clients: { projects, files },
      store: sagaStore,
    })
    expect(second.status).toBe("completed")
    expect(projects.deleteOrganization).toHaveBeenCalledTimes(1)
    expect(files.deleteOrganization).toHaveBeenCalledTimes(2)
  })

  it("fails at the deadline without deleting identity", async () => {
    const sagaStore = store({
      id: "job_2",
      status: "pending",
      deadlineAt: new Date("2026-01-01T00:00:00.000Z"),
      apps: [{ app: "projects", status: "pending" }],
    })
    const result = await runOrganizationDeletionSaga({
      organizationId: "org_1",
      apps: ["projects"],
      clients: { projects: client() },
      store: sagaStore,
      now: new Date("2026-01-02T00:00:00.000Z"),
    })
    expect(result.status).toBe("failed")
    expect(sagaStore.identityDeleted).toEqual([])
  })

  it("runs the user variant with the same retry rule", async () => {
    const projects = client()
    const sagaStore = store({
      id: "job_3",
      status: "pending",
      apps: [{ app: "projects", status: "pending" }],
    })
    const result = await runUserDeletionSaga({
      userId: "user_1",
      organizationId: "org_1",
      apps: ["projects"],
      clients: { projects },
      store: sagaStore,
    })
    expect(result.status).toBe("completed")
    expect(projects.deleteUser).toHaveBeenCalledWith("user_1")
  })
})

describe("export readiness", () => {
  it("never marks a partial export ready", () => {
    expect(
      canMarkExportReady([{ status: "complete" }, { status: "failed" }], 2)
    ).toBe(false)
    expect(canMarkExportReady([{ status: "complete" }], 2)).toBe(false)
    expect(
      canMarkExportReady([{ status: "complete" }, { status: "complete" }], 2)
    ).toBe(true)
  })

  it("serves an app's export part", async () => {
    const GET = createOrganizationExportHandler({
      app: "projects",
      authorizeDelete: async () => undefined,
      authorizeExport: async () => undefined,
      deleteOrganization: client().deleteOrganization,
      deleteUser: client().deleteUser,
      exportOrganization: async (organizationId) => ({
        manifest: {
          app: "projects",
          appVersion: "1.0.0",
          schemaVersion: "2026-11-01",
          generatedAt: new Date("2026-11-01T00:00:00.000Z"),
          tables: { project: 1 },
        },
        data: { project: [{ id: "project_1" }] },
      }),
    })
    const response = await GET(
      new Request(
        "https://projects.example/internal/v1/organizations/org_1/export?organizationId=org_1"
      )
    )
    expect(response.status).toBe(200)
    expect((await response.json()).data.manifest.tables.project).toBe(1)
  })
})

describe("saga status typing", () => {
  it("accepts every persisted status", () => {
    const statuses: SagaStatus[] = [
      "pending",
      "running",
      "partial",
      "completed",
      "failed",
    ]
    const app: SagaAppState = { app: "projects", status: "completed" }
    expect(statuses).toHaveLength(5)
    expect(app.status).toBe("completed")
  })
})

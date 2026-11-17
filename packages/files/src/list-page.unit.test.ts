import { describe, expect, it, vi } from "vitest"

import type { RequestContext } from "@workspace/core/context"
import { encodeCursor } from "@workspace/core/pagination"

import type { FileRepository } from "./repository"
import { FileService, type FileServiceDeps } from "./service"

const ctx: RequestContext = {
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
  organizationId: "org_1",
  roles: ["member"],
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "f1",
    name: "a.txt",
    kind: "document",
    parentId: null,
    ownerId: "user_2",
    modifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    sizeBytes: 10,
    mimeType: "text/plain",
    oid: 1n,
    starred: false,
    trashed: false,
    trashedAt: null,
    shared: false,
    restricted: false,
    shares: [],
    ...overrides,
  }
}

function build(rows: unknown[], ancestors: unknown[] = []) {
  const repo = {
    listPage: vi.fn(async () => rows),
    findManyByIds: vi.fn(async () => ancestors),
  }
  const service = new FileService(
    repo as unknown as FileRepository,
    {} as FileServiceDeps
  )
  return { repo, service }
}

describe("FileService.listPage", () => {
  it("filters files under an unshared restricted folder", async () => {
    const folder = row({
      id: "folder_1",
      name: "Secret",
      kind: "folder",
      restricted: true,
    })
    const hidden = row({ id: "f1", name: "a.txt", parentId: "folder_1" })
    const shared = row({
      id: "f2",
      name: "b.txt",
      parentId: "folder_1",
      shares: [{ userId: "user_1", permission: "view" }],
    })
    const { service } = build([hidden, shared], [folder])

    const page = await service.listPage(ctx, { limit: 10 })
    expect(page.items.map((item) => item.id)).toEqual(["f2"])
  })

  it("lets an owner see restricted files without shares", async () => {
    const { repo, service } = build([row({ restricted: true })])
    const page = await service.listPage(
      { ...ctx, roles: ["owner"] },
      { limit: 10 }
    )
    expect(page.items).toHaveLength(1)
    expect(repo.findManyByIds).not.toHaveBeenCalled()
  })

  it("pages at the repository layer and cursors on the last examined row", async () => {
    const rows = [
      row({ id: "f1", name: "a.txt" }),
      row({ id: "f2", name: "b.txt" }),
      row({ id: "f3", name: "c.txt" }),
    ]
    const { repo, service } = build(rows)

    const page = await service.listPage({ ...ctx, roles: ["owner"] }, { limit: 2 })

    expect(repo.listPage).toHaveBeenCalledWith("org_1", {
      after: null,
      parentId: undefined,
      take: 3,
    })
    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).toBeTruthy()
  })

  it("decodes the opaque cursor and forwards the parent filter", async () => {
    const { repo, service } = build([])
    await service.listPage(ctx, {
      cursor: encodeCursor(["a.txt", "f1"]),
      parentId: "folder_1",
    })
    expect(repo.listPage).toHaveBeenCalledWith("org_1", {
      after: { name: "a.txt", id: "f1" },
      parentId: "folder_1",
      take: 51,
    })
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

const { openLargeObjectStream, uploadLargeObject, unlinkLargeObject } =
  vi.hoisted(() => ({
    openLargeObjectStream: vi.fn(),
    uploadLargeObject: vi.fn(),
    unlinkLargeObject: vi.fn(),
  }))
const { orgQuotaBytes, orgUsedBytes } = vi.hoisted(() => ({
  orgQuotaBytes: vi.fn(),
  orgUsedBytes: vi.fn(),
}))

vi.mock("@/lib/large-object", () => ({
  openLargeObjectStream,
  uploadLargeObject,
  unlinkLargeObject,
}))

vi.mock("./storage", () => ({ orgQuotaBytes, orgUsedBytes }))

import type { RequestContext } from "@/lib/core/context"

import { FileService } from "./service"
import type { FileRepository } from "./repository"

const ctx: RequestContext = {
  userId: "user_1",
  userName: "Ada",
  userEmail: "ada@example.com",
  organizationId: "org_1",
  role: "owner",
}

const sourceRow = {
  id: "file_1",
  organizationId: "org_1",
  name: "plan.pdf",
  kind: "document",
  parentId: null,
  ownerId: "user_1",
  modifiedAt: new Date("2026-10-22T00:00:00Z"),
  sizeBytes: 1024,
  starred: false,
  trashed: false,
  trashedAt: null,
  shared: true,
  restricted: true,
  mimeType: "application/pdf",
  oid: 42n,
  sha256: "source-hash",
  createdAt: new Date("2026-10-22T00:00:00Z"),
  shares: [{ userId: "user_2", permission: "view" }],
  versions: [],
  activities: [],
}

function buildService() {
  const repo = {
    findById: vi.fn(async () => sourceRow),
    findAncestorChain: vi.fn(async () => []),
    create: vi.fn(async () => ({
      ...sourceRow,
      id: "file_2",
      name: "plan (copy).pdf",
      oid: 7n,
      sha256: "copy-hash",
    })),
  }
  return { repo, service: new FileService(repo as unknown as FileRepository) }
}

beforeEach(() => {
  vi.clearAllMocks()
  orgQuotaBytes.mockResolvedValue(10_000)
  orgUsedBytes.mockResolvedValue(0)
  openLargeObjectStream.mockResolvedValue({
    size: 1024,
    stream: { destroy: vi.fn() },
  })
  uploadLargeObject.mockResolvedValue({
    oid: 7,
    size: 1024,
    sha256: "copy-hash",
  })
  unlinkLargeObject.mockResolvedValue(undefined)
})

describe("FileService.duplicateFile", () => {
  it("streams the bytes into a new large object", async () => {
    const { repo, service } = buildService()

    const copy = await service.duplicateFile(ctx, "file_1")

    expect(openLargeObjectStream).toHaveBeenCalledWith(42)
    expect(uploadLargeObject).toHaveBeenCalledTimes(1)
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "plan (copy).pdf",
        oid: 7,
        sha256: "copy-hash",
        sizeBytes: 1024,
        mimeType: "application/pdf",
      })
    )
    expect(copy.id).toBe("file_2")
    expect(copy.hasStorage).toBe(true)
  })

  it("keeps the source's visibility on the copy", async () => {
    const { repo, service } = buildService()

    await service.duplicateFile(ctx, "file_1")

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restricted: true,
        shared: true,
        shares: [{ userId: "user_2", permission: "view" }],
      })
    )
  })

  it("refuses to duplicate when the copy would exceed the quota", async () => {
    const { repo, service } = buildService()
    orgQuotaBytes.mockResolvedValue(1_000)
    orgUsedBytes.mockResolvedValue(500)
    const stream = { destroy: vi.fn() }
    openLargeObjectStream.mockResolvedValue({ size: 1024, stream })

    await expect(service.duplicateFile(ctx, "file_1")).rejects.toMatchObject({
      code: "storage_quota_exceeded",
    })

    expect(uploadLargeObject).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
    // The still-open source stream must release its pooled connection.
    expect(stream.destroy).toHaveBeenCalled()
  })

  it("unlinks the fresh copy when the row insert fails", async () => {
    const { repo, service } = buildService()
    repo.create.mockRejectedValue(new Error("boom"))

    await expect(service.duplicateFile(ctx, "file_1")).rejects.toThrow("boom")

    expect(unlinkLargeObject).toHaveBeenCalledWith(7)
  })
})

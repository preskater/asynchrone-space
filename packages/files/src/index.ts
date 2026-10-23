import { prisma } from "@workspace/db"

import { FileRepository } from "./repository"
import { FileService } from "./service"

export const fileRepository = new FileRepository(prisma)
export const fileService = new FileService(fileRepository)

export { orgQuotaBytes, orgUsedBytes } from "./storage"

export { FileRepository, FileService }
export * from "./schemas"
export type {
  FileActivity,
  FileKind,
  FileLocation,
  FileNode,
  FilesData,
  FileVersion,
  ShareEntry,
  SharePermission,
  UploadItem,
  UploadStatus,
} from "./types"

"use client"

import * as React from "react"

import type { FileLocation } from "@workspace/files/types"

interface FilesNavStore {
  filesLocation: FileLocation
  filesFolderId: string | null
  selectFileLocation: (location: FileLocation) => void
  openFileFolder: (folderId: string | null) => void
}

const FilesNavContext = React.createContext<FilesNavStore | null>(null)

export function FilesNavProvider({ children }: { children: React.ReactNode }) {
  const [filesLocation, setFilesLocation] = React.useState<FileLocation>("my-files")
  const [filesFolderId, setFilesFolderId] = React.useState<string | null>(null)

  const store = React.useMemo<FilesNavStore>(
    () => ({
      filesLocation,
      filesFolderId,
      selectFileLocation: (location) => {
        setFilesLocation(location)
        setFilesFolderId(null)
      },
      openFileFolder: (folderId) => {
        setFilesLocation("my-files")
        setFilesFolderId(folderId)
      },
    }),
    [filesLocation, filesFolderId]
  )

  return <FilesNavContext.Provider value={store}>{children}</FilesNavContext.Provider>
}

export function useWorkspaceNav() {
  const context = React.useContext(FilesNavContext)
  if (!context) throw new Error("useWorkspaceNav must be used within FilesNavProvider")
  return context
}

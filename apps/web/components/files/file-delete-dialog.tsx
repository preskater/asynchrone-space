"use client"

import { useTranslations } from "next-intl"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

import { useFiles } from "@/lib/files/store"
import type { FileNode } from "@/lib/files/types"

/**
 * Confirmation dialog for permanently deleting a node. Rendered outside the
 * file menus: Base UI unmounts menu content when the menu closes, which would
 * take a dialog nested inside it down with it.
 */
export function FileDeleteDialog({
  file,
  open,
  onOpenChange,
}: {
  file?: FileNode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("Files")
  const { deleteForever } = useFiles()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteForeverQuestion")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("deleteForeverDescription", { name: file?.name ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (file) deleteForever(file.id)
              onOpenChange(false)
            }}
          >
            {t("deleteForever")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

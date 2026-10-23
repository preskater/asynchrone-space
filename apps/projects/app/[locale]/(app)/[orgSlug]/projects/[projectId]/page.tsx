import { notFound } from "next/navigation"

import { NotFoundError } from "@workspace/core"
import { projectService } from "@workspace/projects"
import { ProjectWorkspace } from "@workspace/projects/ui/project/project-workspace"

import { resolveWorkspace } from "@/lib/workspace"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; orgSlug: string; projectId: string }>
}) {
  const { locale, orgSlug, projectId } = await params
  const { ctx } = await resolveWorkspace(orgSlug, locale)

  try {
    await projectService.get(ctx, projectId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound()
    }
    throw error
  }

  return <ProjectWorkspace projectId={projectId} />
}

import { z } from "zod"

export const postProjectMessageSchema = z.object({
  projectId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
})

export const postTaskCommentSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
})

export type PostProjectMessageInput = z.infer<typeof postProjectMessageSchema>
export type PostTaskCommentInput = z.infer<typeof postTaskCommentSchema>

import { z } from "zod"

import { crmService } from "@/lib/crm"
import {
  activityInputSchema,
  clientInputSchema,
  contactInputSchema,
  dealInputSchema,
  moveDealSchema,
} from "@/lib/crm/schemas"

import type { McpTool } from "./projects"

export const crmTools: McpTool[] = [
  {
    name: "get_crm_overview",
    title: "Get CRM overview",
    description:
      "Get the CRM workspace: companies, contacts, pipelines with stages, deals (with status), recent activity and custom field definitions.",
    inputSchema: {},
    readOnly: true,
    run: (ctx) => crmService.getOverview(ctx),
  },
  {
    name: "get_client",
    title: "Get client",
    description:
      "Fetch one company with its contacts, deals, projects and activity timeline.",
    inputSchema: { clientId: z.string().describe("The company id") },
    readOnly: true,
    run: (ctx, input) =>
      crmService.getClientDetail(ctx, String(input.clientId)),
  },
  {
    name: "get_deal",
    title: "Get deal",
    description:
      "Fetch one deal with its timeline, contacts and pipeline configuration.",
    inputSchema: { dealId: z.string().describe("The deal id") },
    readOnly: true,
    run: (ctx, input) =>
      crmService.getDealDetail(ctx, String(input.dealId)),
  },
  {
    name: "save_client",
    title: "Create or update a company",
    description:
      "Create a company (without `id`) or update one (with `id`). Status is prospect | active | inactive.",
    inputSchema: clientInputSchema.shape,
    readOnly: false,
    run: (ctx, input) =>
      crmService.saveClient(ctx, clientInputSchema.parse(input)),
  },
  {
    name: "save_contact",
    title: "Create or update a contact",
    description:
      "Create a contact (without `id`) or update one (with `id`). Link it to companies through `companies`.",
    inputSchema: contactInputSchema.shape,
    readOnly: false,
    run: (ctx, input) =>
      crmService.saveContact(ctx, contactInputSchema.parse(input)),
  },
  {
    name: "save_deal",
    title: "Create or update a deal",
    description:
      "Create a deal (without `id`) or update one (with `id`). Moving a deal to a won/lost stage updates its status automatically.",
    inputSchema: dealInputSchema.shape,
    readOnly: false,
    run: (ctx, input) =>
      crmService.saveDeal(ctx, dealInputSchema.parse(input)),
  },
  {
    name: "move_deal",
    title: "Move a deal to another stage",
    description:
      "Move a deal to a pipeline stage at a given position. Ask for a loss reason when moving to a lost stage.",
    inputSchema: moveDealSchema.shape,
    readOnly: false,
    run: (ctx, input) =>
      crmService.moveDeal(ctx, moveDealSchema.parse(input)),
  },
  {
    name: "log_crm_activity",
    title: "Log a CRM activity",
    description:
      "Log a note, call, email or meeting on at least one company, contact or deal.",
    inputSchema: {
      type: z
        .enum(["note", "call", "email", "meeting"])
        .default("note"),
      subject: z.string().optional(),
      body: z.string().describe("The content of the entry"),
      occurredAt: z
        .string()
        .optional()
        .describe("ISO timestamp; defaults to now"),
      clientId: z.string().optional(),
      contactId: z.string().optional(),
      dealId: z.string().optional(),
    },
    readOnly: false,
    run: (ctx, input) =>
      crmService.createActivity(ctx, activityInputSchema.parse(input)),
  },
]

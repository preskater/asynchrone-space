import { z } from "zod"

import { hrService } from "@/lib/hr"
import {
  createTimeOffRequestSchema,
  decideTimeOffRequestSchema,
  logTimeEntrySchema,
  monthKeySchema,
  setWorkLocationSchema,
} from "@/lib/hr/schemas"

import type { McpTool } from "./projects"

export const hrTools: McpTool[] = [
  {
    name: "get_hr_overview",
    title: "Get HR overview",
    description:
      "Get the HR dashboard: members, declared office/remote days, time-off balance and requests, and logged hours for the current user.",
    inputSchema: {},
    readOnly: true,
    run: (ctx) => hrService.overview(ctx),
  },
  {
    name: "list_work_locations",
    title: "List work locations",
    description:
      "List declared office/remote days for every member for a month (YYYY-MM), plus approved leave in that month.",
    inputSchema: {
      month: monthKeySchema.describe("Month key, e.g. 2026-10"),
    },
    readOnly: true,
    run: (ctx, input) =>
      hrService.listLocations(ctx, monthKeySchema.parse(input.month)),
  },
  {
    name: "set_work_location",
    title: "Set work location",
    description:
      "Declare, for the caller, whether they work from the office or remotely on a day. Pass status null to clear the day.",
    inputSchema: {
      date: z.string().describe("Day key, e.g. 2026-10-12"),
      status: z
        .enum(["office", "remote"])
        .nullable()
        .describe("office, remote, or null to clear the day"),
      note: z.string().optional(),
    },
    readOnly: false,
    run: (ctx, input) =>
      hrService.setWorkLocation(ctx, setWorkLocationSchema.parse(input)),
  },
  {
    name: "request_time_off",
    title: "Request time off",
    description:
      "Create a time-off request for the caller. Duration is counted in business days (Mon-Fri).",
    inputSchema: {
      type: z
        .enum(["vacation", "sick", "personal", "unpaid"])
        .default("vacation"),
      startDate: z.string().describe("Day key, e.g. 2026-10-26"),
      endDate: z.string().describe("Day key, inclusive"),
      reason: z.string().optional(),
    },
    readOnly: false,
    run: (ctx, input) =>
      hrService.createTimeOffRequest(
        ctx,
        createTimeOffRequestSchema.parse(input)
      ),
  },
  {
    name: "decide_time_off",
    title: "Approve or reject time off",
    description:
      "Approve or reject a pending time-off request. Requires the admin or owner role.",
    inputSchema: {
      requestId: z.string(),
      decision: z.enum(["approved", "rejected"]),
    },
    readOnly: false,
    run: (ctx, input) =>
      hrService.decideTimeOffRequest(ctx, String(input.requestId), {
        ...decideTimeOffRequestSchema.parse({ decision: input.decision }),
      }),
  },
  {
    name: "log_time_entry",
    title: "Log hours worked",
    description:
      "Log (or replace) the hours the caller worked on a day. One entry per day.",
    inputSchema: {
      date: z.string().describe("Day key, e.g. 2026-10-12"),
      hours: z.number().min(0.25).max(24),
      note: z.string().optional(),
    },
    readOnly: false,
    run: (ctx, input) =>
      hrService.logTimeEntry(ctx, logTimeEntrySchema.parse(input)),
  },
]

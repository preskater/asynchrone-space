# Task templates as form configurations

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-15

## Context and Problem Statement

Task creation was a single generic form. The workspace needs GitHub-issues-style
"issue forms": admins define templates (bug report, design request, marketing
brief, …) whose fields follow the team's process, while everyone keeps a quick
"title + description" path for small work. Templates must pre-fill the standard
task fields (status, priority, labels) and add custom inputs, and the values
filled from a template must stay structured (not flattened into the
description) so they can be shown and edited later.

## Decision Drivers

- One entry point: "Create task" should first offer the available templates,
  including an explicit quick-task option, instead of burying a template
  selector inside the form.
- The default (quick) form must go through the same rendering path as
  templates; "the default form is a configuration", not a special case.
- Custom inputs cover the team's needs with a small fixed vocabulary: short
  text, long text, dropdown, single choice, multiple choice and date.
- Server-side validation: required fields are enforced in the service, not
  only in the UI, so API/MCP callers get the same guarantees.
- Keep migrations additive; existing tasks and templates keep working.

## Considered Options

- **A: New models per field type** (`TaskTemplateField` table with per-type
  tables for options/values). Normalized but heavy: every render needs joins,
  and order/type changes require schema changes.
- **B: Field definitions as JSON on `TaskTemplate` + values as JSON on
  `Task`** (the pattern already used by CRM custom fields), with validation in
  the service.
- **C: Flatten template values into the task description** (GitHub-style).
  Loses structure; values become unqueryable and uneditable.

## Decision Outcome

Chosen option: **B**, matching the established `CrmFieldDefinition` precedent.

- `TaskTemplate.fields: Json` stores an array of `TaskTemplateField`
  (`id`, `label`, `type`, `required`, `options`); `id` is a stable key used to
  store values.
- `Task.customFields: Json` stores values keyed by field id
  (`string` for text/select/radio/date, `string[]` for multiple choice) and
  `Task.templateId` references the template that produced the task
  (`onDelete: SetNull`; deleted templates do not delete tasks).
- `createTaskSchema`/`updateTaskSchema` accept `templateId` and
  `customFields`; the service normalizes values against the template's current
  definitions, drops blanks, coerces date values to ISO and rejects missing
  required fields with the existing `custom_field_required` error code and the
  field's label as a param.
- UI flow: "Create task" opens a template chooser step (Quick task card +
  templates) and then the form step; the form always renders the default
  fields and appends the template's fields, so the quick path is the same code
  with an empty field list. Board per-column "+" buttons skip the chooser and
  stay quick-create. Templates are managed in Project settings → Task
  templates (owner/admin only, the existing `canManage` gate).

### Positive Consequences

- Adding a field or option is a data change, not a migration; templates can be
  edited freely and validation stays in one place.
- Tasks created via the UI, the REST API and MCP share identical validation
  and normalization.
- Values stay structured: the task panel can render meaningful labels (e.g.
  dates formatted, multiple choices joined) and the edit dialog can update
  them.

### Negative Consequences

- Editing a template re-interprets existing task values against the new
  definitions; removed fields silently drop their values on the next save of
  a task (same trade-off as CRM custom fields).
- `customFields` is `Json`, so ad-hoc SQL reporting on a field needs JSON
  operators; strongly-typed reporting would need a normalized model later.

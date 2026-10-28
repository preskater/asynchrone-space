# Customizable appearance and animations

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-19

## Context and Problem Statement

The workspace was monochrome and every organization looked the same. Issue #52
asked for:

- fixed, recognizable colors per task priority;
- company-level themes (predefined or custom) so each organization can express
  its own artistic direction;
- configurable animation levels (basic, fluid, fantastic) with individual
  effects;
- per-user accessibility overrides (high contrast, disable all animations) that
  do not affect other members.

## Decision Drivers

- Themes must be trivial to add and safe to store without a migration whenever
  a new preset is created.
- Effects must be implemented with CSS (buttons and inputs live in
  `@workspace/ui`) and must not require React re-renders while hovering.
- A user preference must override the company defaults without changing the
  company configuration.
- No flash of the wrong theme on the first paint, and no effect may break
  keyboard focus or contrast.

## Considered Options

- **A: Store appearance in dedicated Prisma columns.** Rejected: every preset
  or effect change would need a migration, and the theme object is only ever
  read as a whole.
- **B: Store appearance in `Organization.metadata` JSON.** Chosen: the column
  already exists (it also holds the billing `plan`), so updates merge into the
  existing object and invalid/unknown values fall back to defaults.
- **C: Put user accessibility preferences in the database.** Rejected for now:
  the issue explicitly scopes them to the user's session; `localStorage` matches
  the existing `next-themes` behaviour and needs no schema change.

## Decision Outcome

Chosen option: **B**, with a small **C** companion.

- `Organization.metadata.appearance` stores `{ theme, custom, animations }`.
  `getOrganizationAppearance`/`updateOrganizationAppearance` normalise the JSON,
  preserve other metadata keys and restrict writes to owners/admins.
- Themes are CSS variable sets selected through `data-org-theme` on the app
  root. Presets only define two brand hues; surfaces, borders, secondary and
  sidebar colors are derived with `color-mix`, so a new theme is a few lines.
  The custom theme writes its colors as inline CSS custom properties.
- Animation intensity is `data-motion-level` (`basic`/`fluid`/`fantastic`) and
  each effect is an independent `data-fx-*` attribute. All hover/press effects
  are pure CSS applied to `data-slot="button"`, `input`, `textarea`, etc. The
  `fantastic` level adds the signature fire, shimmer and aurora effects.
- Priority labels use fixed `--priority-*` tokens (blue/amber/orange/red),
  independent from the organization theme. `PriorityBadge` renders
  `data-priority`; the animation layer only decorates it.
- Per-user preferences (`highContrast`, `disableAnimations`) live in
  `localStorage` under `asynchrone-space.appearance.user.<userId>` and are mirrored to
  `data-contrast` / `data-motion` on `<html>`. An inline boot script applies them
  (and the organization theme) before the first paint.
- `prefers-reduced-motion` is honoured independently, and high contrast
  disables decorative pseudo-elements while keeping focus rings.

### Positive Consequences

- Adding a theme preset is a CSS-only change; organizations can also pick their
  own two colors and radius.
- Every effect is composable and can be turned off without touching component
  code; the user override wins over company settings.
- Priority labels stay recognizable in every theme and in high contrast mode.

### Negative Consequences

- `Organization.metadata` is a shared, schemaless JSON blob: writers must merge
  instead of overwrite, and values are normalised on read.
- User accessibility preferences are browser-local; they do not follow a user
  across devices (a future `User` preference model could change this).
- The `fantastic` level deliberately uses heavy decorative CSS; the motion-off
  switch and the OS reduced-motion query are required escape hatches.

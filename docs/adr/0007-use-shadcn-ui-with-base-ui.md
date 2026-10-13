# Use shadcn/ui with Base UI and Tailwind CSS

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

Presk needs a consistent, accessible component library shared between the app and
future surfaces, while retaining full control over markup and styling. The
workspace also migrated its component primitives from Radix UI to Base UI. How
should the UI layer be built and distributed across the monorepo?

## Decision Drivers

- Components must be shared from `packages/ui` into the app.
- Full ownership of component source (copy-in) rather than an opaque dependency.
- Accessible primitives for menus, dialogs, popovers, and other interactions.
- A utility-first styling system with consistent design tokens.

## Considered Options

- shadcn/ui components on Base UI primitives with Tailwind CSS.
- A packaged third-party component library (e.g. MUI, Mantine).
- Fully hand-rolled components with no primitive library.

## Decision Outcome

Chosen option: "shadcn/ui on Base UI primitives with Tailwind CSS", because
components are copied into `packages/ui` where they can be edited freely, Base UI
supplies accessible primitives, and Tailwind provides consistent styling.

`packages/ui/src/components/*` holds the owned components, `components.json`
drives the shadcn CLI, Tailwind with `prettier-plugin-tailwindcss` handles
styling, and the app imports them after `transpilePackages: ["@workspace/ui"]`.

### Positive Consequences

- Component source is owned and editable; behavior can diverge from upstream
  without forking a dependency.
- Accessible primitives come from Base UI, avoiding re-implemented focus and
  keyboard handling.
- Tailwind class ordering is enforced in formatting via
  `prettier-plugin-tailwindcss`.

### Negative Consequences

- Copied components do not receive upstream fixes automatically; upgrades are
  manual.
- The Base UI migration means some patterns and docs differ from the more
  common Radix-based shadcn examples.
- Consumers must be aware of the `transpilePackages` requirement for UI imports.

## Pros and Cons of the Options

### shadcn/ui on Base UI with Tailwind

- Good, because components are owned, editable source.
- Good, because Base UI provides accessible primitives.
- Bad, because updates must be pulled in manually.

### Packaged third-party library

- Good, because it is maintained and versioned by its authors.
- Bad, because styling and markup are constrained by the library's theming
  system.

### Fully hand-rolled components

- Good, because there are no dependencies or upstream constraints.
- Bad, because accessibility and interaction behavior must be built and tested
  from scratch.

## Links

- `packages/ui/src/components/**`
- `apps/web/components.json`
- `apps/web/next.config.ts` (`transpilePackages`)
- `.prettierrc` (`prettier-plugin-tailwindcss`)

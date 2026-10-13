# Use next-intl for internationalization

- Status: accepted
- Deciders: Presk maintainers
- Date: 2026-10-10

## Context and Problem Statement

Presk serves users in multiple languages, starting with English and French. Every
route must be locale-aware, and users should be able to switch languages without
losing their place. How should internationalization be implemented across the
App Router?

## Decision Drivers

- Locale-aware routing integrated with the Next.js App Router.
- A single source of truth for the supported locales and default locale.
- Translated content colocated in message catalogs per locale.
- Server and client components must both access translations consistently.

## Considered Options

- next-intl with locale-prefixed routing.
- A hand-rolled i18n layer over dictionaries.
- No i18n initially, retrofitted later.

## Decision Outcome

Chosen option: "next-intl with locale-prefixed routing", because it provides
first-class App Router integration, a typed routing config, and message
catalogs, with minimal glue.

`i18n/routing.ts` declares `locales: ["en", "fr"]`, `defaultLocale: "en"`, and
`localePrefix: "always"`, so every URL carries its locale. The request config
lives in `i18n/request.ts`, navigation helpers in `i18n/navigation.ts`, messages
in `apps/web/messages/<locale>/*.json`, and the app is wrapped by
`createNextIntlPlugin()` in `next.config.ts`.

### Positive Consequences

- The `[locale]` segment composes cleanly with the `[orgSlug]` segment.
- Locale and default are declared once and reused by routing and the plugin.
- Message catalogs are split per feature (`auth.json`, etc.), keeping files
  small.

### Negative Consequences

- `localePrefix: "always"` means the root path redirects, and links must go
  through the provided navigation helpers rather than raw `next/link`.
- Every new user-facing string must be added to at least two catalogs.
- Locale switching and metadata must be handled deliberately in layouts.

## Pros and Cons of the Options

### next-intl with locale-prefixed routing

- Good, because App Router integration and routing are built in.
- Good, because catalogs and locale config are simple and typed.
- Bad, because raw links must be replaced with locale-aware navigation helpers.

### Hand-rolled i18n over dictionaries

- Good, because there are no dependencies or conventions to learn.
- Bad, because locale detection, routing, and server/client parity must be
  implemented and maintained.

### No i18n initially

- Good, because it avoids upfront complexity for a single-language audience.
- Bad, because retrofitting i18n into established routes and components is
  expensive.

## Links

- `apps/web/i18n/routing.ts`
- `apps/web/i18n/request.ts`
- `apps/web/i18n/navigation.ts`
- `apps/web/messages/**`
- `apps/web/next.config.ts` (`createNextIntlPlugin`)

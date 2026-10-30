# License under the Elastic License 2.0

- Status: accepted
- Deciders: Asynchrone Space maintainers
- Date: 2026-10-30

## Context and Problem Statement

The repository shipped under the MIT License ("Copyright (c) 2026 Preskater"),
and every workspace `package.json` declared `"license": "MIT"`. MIT permits
anyone to use, modify, sublicense and **sell** the software — including running
these exact Helm charts as a competing hosted product, with no obligation to
contribute anything back.

We are moving to a commercial model: the software is deployed for paying
customers, the charts and the control tower are part of what we sell, and the
hosted service is the product. A licence that allows a competitor to offer the
same hosted service from our repository undermines that model before it starts.

At the same time the repository is public and we want to keep it that way: a
public repository is how customers audit the code they run, how prospects
evaluate us, and how contributors find and improve the project.

How do we keep the code public and modifiable while reserving the hosted-service
business, and what has to change in the repository for the new terms to be
coherent and enforceable?

## Decision Drivers

- A competitor must not be able to host our software for third parties as a
  product. That is the one thing MIT does not prevent.
- Self-hosting, evaluation, forks and internal modification must stay permitted:
  enterprise customers ask for a helm install in their own cluster, and
  contributors need to run the code.
- The public repository, issue tracker and pull-request workflow stay as they are.
- The terms must be a recognised, unmodified licence text — ours is not the
  wording a customer's legal team wants to review from scratch.
- Nothing may break the build, CI or the published images.
- The dependency tree must remain distributable under the new terms.

## Considered Options

- **Keep MIT, open-core.** Only viable if the paid features are cleanly
  separable from the open ones. They are not: billing, the control tower and the
  Helm deployment are woven through the same apps and the same database schema.
  Splitting them is a much larger project and would still leave the hosted
  product resellable under MIT for the open part.
- **Proprietary, all rights reserved, plus an EULA.** Strongest protection, but
  it means closing the repository (or publishing a source dump nobody may
  modify), which loses the auditability and contribution benefits we rely on.
- **BUSL-1.1.** Source-available with a competing-service ban, but the
  Additional Use Grant is bespoke prose we would have to draft and defend, and
  each release converts after four years to a licence we pick today.
- **FSL-1.1-MIT.** Very close in effect to what we want, but it converts each
  release to MIT after two years — short for a product whose charts we intend to
  keep commercial.
- **Elastic License 2.0.** A short, fixed, widely reviewed source-available
  licence: use, copy, distribute, modify and prepare derivative works are
  granted; providing the software to third parties as a hosted or managed
  service is not. No conversion timer.

## Decision Outcome

The project is licensed under the **Elastic License 2.0** (SPDX: `Elastic-2.0`)
from **2026-10-30**.

Adopted because it is the closest match to the one restriction we actually need
(no competing hosted service) expressed in a text a customer's counsel can read
in five minutes, without giving up the public repository, the ability to modify
and self-host, or the ability to keep selling the hosted product.

### What changed

- `LICENSE` now carries the Elastic License 2.0 verbatim, under a
  "Copyright (c) 2026 Preskater" heading.
- `license` is `Elastic-2.0` in the root `package.json` and in every workspace
  package (`apps/web`, `apps/control-tower`, `packages/*`).
- The README badge and licence section state source-available, not open source.
- `CONTRIBUTING.md` replaces the MIT contribution grant with a
  [CLA](../../CLA.md) requirement: contributions stay licensable for
  redistribution under `Elastic-2.0` **and** relicensable if the commercial model
  changes again. A CLA, not a DCO, because the whole point of this record is that
  the licence may need to move again.
- `THIRD-PARTY-NOTICES.md` records the dependency-licence audit.

### Effective date and prospective application

The new terms apply to every release from 2026-10-30 onward. Code already
published under MIT — the tagged releases before that date and anyone who
already obtained a copy — stays usable under MIT; we cannot retract a grant that
has already been made, and we do not try to. Copies and releases distributed
from this repository after the effective date carry `Elastic-2.0`.

Existing contributions do not need to be re-signed: MIT already permitted the
copyright holder to license the combined work under other terms. The CLA governs
contributions from the effective date onward.

### Third-party obligations

Audited in [THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md). No GPL, AGPL or
SSPL dependency exists, so no dependency forces the application's licence.
Obligations that remain ours and must survive any packaging change:

- MIT / ISC / BSD / Apache-2.0 notices ship with the image (they already do, in
  `node_modules/<package>/LICENSE`, and `NOTICE` files where present).
- LGPL-3.0-or-later (`@img/sharp-libvips-*`): keep the licence text and keep the
  library replaceable — do not statically compile libvips into our code.
- MPL-2.0 (`lightningcss`, `axe-core`) and EPL-2.0 (`elkjs`): unmodified
  consumption only; patching one of those files would require publishing it.
- CC-BY-4.0 (`caniuse-lite`): keep the attribution.

The Elastic License 2.0 restricts our software; it does not relicense or
restrict the dependencies, and nothing in the audit blocks commercial
distribution.

## Consequences

### Positive

- A competitor can no longer stand up a hosted Asynchrone Space from this
  repository; self-hosting, internal forks and evaluation remain permitted.
- The repository, issue tracker and contributor workflow stay public.
- The licence is a fixed, recognised text with a clear patent grant, so
  procurement and counsel review is routine.
- The CLA keeps future licensing changes cheap.

### Negative

- The project is no longer open source by the OSI definition; "open source" must
  not appear in our marketing, README or package metadata.
- Some contributors care about OSI licences and will not contribute to a
  source-available project. The CLA adds friction on top of that.
- The hosted-service restriction is the kind of clause some enterprise legal
  teams scrutinise; we will be asked what counts as "substantial set of the
  features or functionality".
- Distributing the charts and the control tower to customers now needs a
  commercial agreement — the licence grants no right to provide them as a
  service — so the sales contract, not the licence, carries the customer's
  hosting rights.
- Releases published before 2026-10-30 stay MIT forever; the split is
  permanent and must be stated correctly in any future licence question.

### Follow-ups

- Legal review of the `Elastic-2.0` choice and of the CLA wording by whoever
  owns the commercial decision. This record documents engineering's
  implementation of that decision; it is not legal advice.
- Record CLA signatures for external contributors who land a pull request after
  the effective date.
- GitHub repository settings: the licence is detected from `LICENSE`, so no
  metadata field needs editing, but re-check the detected licence after the
  merge and keep the repository public.
- Tag the last MIT release (or confirm which tag it is) so the pre-2026-10-30
  line is unambiguous.

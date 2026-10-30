# Third-party notices

Asynchrone Space is distributed under the [Elastic License 2.0](./LICENSE). That
licence covers the code in this repository only. Third-party packages we install
or ship with the Docker image keep their own licences, and those obligations
continue to apply to anyone who receives a copy from us.

This file records the audit behind
[ADR 0025](./docs/adr/0025-license-under-elastic-license-2.0.md). It is not a
generated inventory of every transitive package — the full texts ship inside
`node_modules/<package>/LICENSE` in the image, which is what the MIT, ISC, BSD
and Apache-2.0 licences require. It records the cases where the obligation is
more than "keep the notice".

## Summary

| Licence family         | Packages | Obligation under the new terms                                                         |
| ---------------------- | -------- | -------------------------------------------------------------------------------------- |
| MIT / ISC / BSD / 0BSD | ~1020    | Keep the copyright and permission notice. Nothing conflicts.                           |
| Apache-2.0             | ~100     | Keep `LICENSE` and any `NOTICE` file; state modifications if we patch.                 |
| MPL-2.0                | 26       | File-level copyleft: unmodified use is fine; changes to those files must be published. |
| EPL-2.0                | 1        | Weak copyleft on the package; unmodified, dynamically consumed use is fine.            |
| LGPL-3.0-or-later      | 14       | Ship the licence text and keep the library replaceable.                                |
| CC-BY-4.0              | 1        | Attribution required.                                                                  |
| Unlicense / BlueOak    | 5        | No attribution required; notice kept anyway.                                           |

No GPL, AGPL, SSPL or other strong copyleft dependency is present, so nothing in
the dependency tree forces us to license the application itself differently.

## Packages that need attention

### `@img/sharp-libvips-*`, `@img/sharp-*` — LGPL-3.0-or-later

`sharp` (image processing for uploads and previews) links against libvips, which
is LGPL-3.0-or-later, shipped as prebuilt binaries. LGPL obligations are met by
dynamic linking plus the ability for a recipient to replace the library:

- ship the LGPL-3.0 text alongside the package (already in
  `node_modules/@img/sharp-libvips-*/LICENSE`),
- keep `sharp` a normal npm dependency in the image rather than statically
  compiled into our code, so a recipient can swap it,
- if we ever fork or patch libvips, publish that source.

### `lightningcss*`, `axe-core`, `@axe-core/playwright` — MPL-2.0

MPL-2.0 is file-level copyleft. We consume these unmodified, so only the notice
obligation applies. If we ever patch a file inside them, the patched file's
source must be made available under MPL-2.0.

### `elkjs` — EPL-2.0

Used by the diagram renderer. Consumed unmodified as a separate module, which
satisfies EPL-2.0. Modifications to `elkjs` itself must be released under
EPL-2.0.

### `caniuse-lite` — CC-BY-4.0

Browser-support data, built into the bundle by Browserslist/Next.js. CC-BY-4.0
requires attribution, so the attribution notice stays in the image.

### Apache-2.0 packages

Apache-2.0 is compatible with a source-available distribution: it only requires
that recipients keep the licence, any `NOTICE` file, and any statements we add
about modifications. We do not modify these packages today.

## What this means for our own code

The Elastic License 2.0 adds restrictions on _our_ software; it cannot and does
not relicense dependencies. Recipients of the Docker image or the Helm charts
receive the dependency licences and must honour them, which the notices above
make possible. Nothing here restricts us from commercial distribution.

## Keeping this current

Re-run the audit when adding a dependency with a non-permissive licence, and
record the result here:

```bash
node -e '
const fs = require("fs");
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const found = {};
for (const [path, info] of Object.entries(lock.packages || {})) {
  if (!path) continue;
  const license = Array.isArray(info.license) ? info.license.join(" OR ") : info.license;
  if (!license) continue;
  found[license] = (found[license] || 0) + 1;
}
console.log(Object.entries(found).sort((a, b) => b[1] - a[1]));
'
```

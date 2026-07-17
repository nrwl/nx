# Developing Packages Locally

## Running your locally built package

By default the workspace's tooling resolves the _published_ packages
installed in `node_modules` — local source changes and rebuilds are
invisible to it. To dogfood a locally built package:

1. Build it once: `nx build <package>` (e.g. `nx build nx`).
2. Link it one time: `pnpm link ./packages/<package>`.
3. From then on, rebuilding with `nx build <package>` is reflected in the
   workspace — no re-linking needed.

Without the link, no amount of rebuilding shows up in the CLI or tooling
you invoke.

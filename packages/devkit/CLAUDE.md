# @nx/devkit

## Architecture

`@nx/devkit` serves two purposes: it **re-exports** core types and utilities from the `nx` package, and it **defines its own utilities** that are useful for plugin authors but aren't needed by `nx` core itself.

### Entry Point Structure

```
@nx/devkit (index.ts)
  ├── re-exports: nx/src/devkit-exports      (stable public API)
  ├── exports: ./public-api                   (plugin-author utilities defined in devkit)
  │     └── may import from: nx/src/devkit-internals (NOT re-exported to consumers)
  │
  ├── @nx/devkit/testing       → nx/src/devkit-testing-exports
  ├── @nx/devkit/ngcli-adapter → nx/src/adapter/ngcli-adapter
  └── @nx/devkit/internal      → nx/src/devkit-internals (subset)
```

## Importing from `nx`

**Every import from the `nx` package must come from `nx/src/devkit-exports`
or `nx/src/devkit-internals` — no other `nx` deep imports.** This is
enforced by the `@typescript-eslint/no-restricted-imports` rule in
`packages/devkit/eslint.config.mjs`. The two entry points exist so the
surface devkit depends on is explicit and version-checkable; a deep import
into arbitrary `nx` internals silently breaks the compatibility contract
below, because nothing tracks whether that internal exists across the
supported `nx` versions.

## Rules for the other packages in this repo

Every other first-party package (`@nx/js`, `@nx/react`, ...) must get its
core types and utilities **from `@nx/devkit` or `@nx/devkit/internal` —
never by importing `nx` directly**. Devkit is the compatibility boundary:
it is the one place that knows which `nx` entry points are safe across the
supported version range, and a direct `nx` import bypasses that entirely.

## Version Compatibility Contract

**This is the most important thing to understand when modifying devkit or its nx entry points.**

`@nx/devkit` supports `nx` at the current major version **+/- 1 major version**. The `peerDependencies` in `package.json` encode this — e.g. `"nx": ">= 21 <= 23"` means `@nx/devkit@22` works with `nx@21`, `nx@22`, and `nx@23`.

**These rules govern the _main public exports_ of `@nx/devkit` (the root
entry point).** The `@nx/devkit/internal` entry point is exempt: it exists
only for the first-party packages in this repo, and those are all released
in lockstep at the same version — an `@nx/react@23` always runs with
`@nx/devkit@23` — so the internal API carries no cross-version
compatibility burden and can change freely between majors.

**The contract cuts both ways.** `@nx/devkit@23` must work with `nx@22`,
`nx@23`, and keep working up through `nx@24` — and, equally, changes to
`nx` itself must not break the _previous_ devkit major: while developing
`nx@23`, verify it remains compatible with the published `@nx/devkit@22`
(plugins in the wild pair a newer `nx` with an older devkit all the time).
In practice: treat everything reachable from `devkit-exports` and
`devkit-internals` as an API that published devkit versions within the
supported window already depend on — removing or reshaping it is a break
even when nothing inside this repo still uses it.

### What This Means for Changes

#### `nx/src/devkit-exports.ts` (the public API surface)

- Everything exported here becomes the public API of `@nx/devkit`.
- **Minimize additions** — the file has a warning: "STOP! Try hard to not add to this API."
- New exports are safe for current consumers but adding then removing them creates breaking changes.

#### `nx/src/devkit-internals.ts` (semi-private bridge)

- These are used **internally** by `@nx/devkit`'s own implementation code (e.g. `packages/devkit/src/`).
- They are **NOT** part of `@nx/devkit`'s public API.
- The file warns: "These may not be available in certain versions of Nx, so be sure to check them first."
- **When `@nx/devkit` code imports from `devkit-internals`, it must handle the case where that export doesn't exist** in an older supported `nx` version. Guard with runtime checks or ensure the export has existed since the oldest supported major.

#### `packages/devkit/public-api.ts` (plugin-author utilities owned by devkit)

- Utilities implemented in `packages/devkit/src/` that are useful for plugin authors but not needed by `nx` core (e.g. `formatFiles`, `generateFiles`, `parseTargetString`).
- These are **defined here, not re-exported from `nx`** — devkit is the source of truth for this code.
- Code here may import from `nx/src/devkit-internals` — same version-guarding rules apply.

### Practical Guidelines

1. **Adding a new export to `devkit-exports.ts`**: This is a public API addition. Keep the surface area small. Once published, removing it is a breaking change.
2. **Adding a new export to `devkit-internals.ts`**: Safe to add, but any `@nx/devkit` code consuming it must account for older `nx` versions where it won't exist.
3. **Removing an export from either file**: Only safe if no published `@nx/devkit` version within the supported range depends on it.
4. **Changing the signature of an existing export**: Must remain compatible across all supported `nx` major versions.

## Key Files

| File                                        | Purpose                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/devkit/index.ts`                  | Main entry point — re-exports from `nx` + `public-api`                     |
| `packages/devkit/public-api.ts`             | Plugin-author utilities owned by devkit (formatFiles, generateFiles, etc.) |
| `packages/nx/src/devkit-exports.ts`         | Stable public API surface exposed through `@nx/devkit`                     |
| `packages/nx/src/devkit-internals.ts`       | Semi-private internals used by devkit's implementation                     |
| `packages/nx/src/devkit-testing-exports.ts` | Testing utilities for `@nx/devkit/testing`                                 |

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

## Version Compatibility Contract

**This is the most important thing to understand when modifying devkit or its nx entry points.**

`@nx/devkit` supports `nx` at the current major version **+/- 1 major version**. The `peerDependencies` in `package.json` encode this — e.g. `"nx": ">= 21 <= 23"` means `@nx/devkit@22` works with `nx@21`, `nx@22`, and `nx@23`.

**This tolerance applies to the public `@nx/devkit` API surface only.** It exists for _external_ plugins, which are built against one `@nx/devkit` major and may run against a neighbouring `nx`. It does **not** extend to `@nx/devkit/internal` — see below.

### What This Means for Changes

#### `nx/src/devkit-exports.ts` (the public API surface)

- Everything exported here becomes the public API of `@nx/devkit`.
- **Minimize additions** — the file has a warning: "STOP! Try hard to not add to this API."
- New exports are safe for current consumers but adding then removing them creates breaking changes.

#### `nx/src/devkit-internals.ts` (semi-private bridge, surfaced as `@nx/devkit/internal`)

- These are **NOT** part of `@nx/devkit`'s public API. This barrel re-exports `nx` internals wholesale.
- It has **two classes of consumer, with different rules**:
  1. **`@nx/devkit`'s own implementation code** (`packages/devkit/src/`). This ships to external plugins, so it _does_ run under the +/- 1 major tolerance: `@nx/devkit@23` may be installed against `nx@22`. **Code here must handle the export not existing** — guard with runtime checks, or only use symbols that have existed since the oldest supported `nx` major.
  2. **First-party plugins in this repo**, via `@nx/devkit/internal`. These are released in lockstep with the `nx` version they are built against, so they require an **exactly matching `nx`** and need no version guarding.
- **External plugins must not import `@nx/devkit/internal`.** It carries no version-tolerance contract, and on a mismatched `nx` its symbols are `undefined` rather than a load error — so the failure surfaces late and confusingly.

#### `packages/devkit/public-api.ts` (plugin-author utilities owned by devkit)

- Utilities implemented in `packages/devkit/src/` that are useful for plugin authors but not needed by `nx` core (e.g. `formatFiles`, `generateFiles`, `parseTargetString`).
- These are **defined here, not re-exported from `nx`** — devkit is the source of truth for this code.
- Code here may import from `nx/src/devkit-internals`, as consumer class 1 above — it ships to external plugins, so version-guarding rules apply.

### Practical Guidelines

1. **Adding a new export to `devkit-exports.ts`**: This is a public API addition. Keep the surface area small. Once published, removing it is a breaking change.
2. **Adding a new export to `devkit-internals.ts`**: Safe to add. First-party plugins consuming it via `@nx/devkit/internal` ship in lockstep, so they need no version guarding; `packages/devkit/src/` code consuming it still does (see the two consumer classes above). Weigh the eager-load cost too: every plugin worker loads this barrel, so a value export drags its whole require closure into graph construction. Prefer `export type` where the symbol is only used as a type.
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

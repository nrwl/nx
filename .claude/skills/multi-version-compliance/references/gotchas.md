# Gotchas & edge cases

Non-obvious behavior. Load these into your model before auditing or reviewing.

## `latest` / `next` dist-tags

When a workspace declares `"<pkg>": "latest"` or `"next"` in its `package.json`:

- `assertSupportedPackageVersion` no-ops via `isNonSemverDistTag` (NON_SEMVER_DIST_TAGS = `['latest', 'next']`). The floor check is skipped entirely.
- `getDeclaredPackageVersion` falls back to the cleaned `latestKnownVersion` argument (if provided) or returns `null`.
- `versions(tree)` returns `latestVersions` (the fresh-install path).

Tests must include `latest` and `next` cases. Both are no-ops; neither throws.

## pnpm `catalog:` references

Declared versions may be `"catalog:default"`, `"catalog:typescript"`, etc. (since pnpm 9.5):

- `getDependencyVersionFromPackageJson` (via the catalog manager in devkit) resolves these before the helper sees them. Don't call `clean`/`coerce` on raw values.
- `normalizeSemver` behavior on a raw `catalog:` string is not explicitly tested (open question — verify if you encounter it).

Reference: PR `#35459` (`fix(misc): resolve pnpm catalog: refs in version lookups`) — landed catalog ref handling.

## Fresh-install path (package not declared)

When `<pkg>` is missing from the workspace's `package.json` entirely:

- `assertSupportedPackageVersion` no-ops.
- `versions(tree)` returns `latestVersions`.
- The generator proceeds with the fresh-install constant (e.g., `playwrightVersion = '^1.37.0'`).

This is intentional — the generator is being run on a new workspace or one that's adding this package for the first time.

## Error message preserves declared range, not cleaned semver

```
  Installed: ~18.2.0
  Supported: >= 19.0.0
```

`Installed:` shows what's in `package.json` verbatim. Don't try to normalize it in the error message — it tells the user exactly what they typed, which helps them find it.

The argument flow: `assertSupportedPackageVersion` calls `throwForUnsupportedVersion(packageName, declared, minSupportedVersion)` with the raw `declared` value.

## Cypress's `getCypressVersionFromTree` stays inline

The shared `getDeclaredPackageVersion` falls back to `latestKnownVersion` when the declared value is `latest`/`next` or missing. Cypress's tree path returns `null` on missing. These semantics differ enough that the helper can't be consolidated without changing behavior.

The FS path (`getCypressVersionFromFileSystem`) was migrated to `getInstalledPackageVersion` (better resolution for pnpm strict / nested installs). The tree path stayed inline.

Reference: `packages/cypress/src/utils/versions.ts` after `#35670`.

## Double-asserts are fine

When `configurationInternal` calls `initInternal` (or any generator chain), both call their respective `assertSupportedXVersion(tree)`. The assert is idempotent and cheap (one tree read + one semver comparison). Don't refactor away.

The `assertGeneratorsEnforceVersionFloor` test treats both entry points as separate generators and asserts each throws — which is what we want.

## Angular ecosystem lockstep — what `@angular/core >=N` covers

Peer-locked to `@angular/core` (one `requires` on the primary is sufficient):

- `@angular/cli`
- `@angular/ssr`
- `@angular-devkit/build-angular` **from v20+** (NOT v19 — `@angular-devkit/build-angular@19` does not peer-on `@angular/core`)
- `@angular/material`, `@angular/cdk`, all `@angular/*` framework packages
- `@schematics/angular`

Independent (need their own `requires`):

- `@ngrx/*`
- `@angular-eslint/*`
- `zone.js`
- `jest-preset-angular`
- `karma`, `karma-*`
- `protractor` (deprecated)
- `tailwindcss` and CSS-tooling siblings

Always verify pairing at the actual version range being bumped from — `@angular-devkit/build-angular` is the classic gotcha (peers on `@angular/core` in some versions, not others).

## Pruned migrations leave no trace in `migrations.json`

Older `packageJsonUpdates` entries (e.g., `12.x` migrations) are removed during normal Nx version cleanup waves. They don't show up in the current `migrations.json` but their absence is meaningful — users on an old floor have no auto-bump path to the new floor.

Check via:

```sh
git log --all --oneline -p -- packages/<plugin>/migrations.json | head -200
git log --all --diff-filter=D --name-only -- packages/<plugin>/migrations.json
```

When raising a floor by N+ majors, decide whether to:

1. Add a `packageJsonUpdates` entry bridging sub-floor → floor (the user gets auto-bumped on `nx migrate`).
2. Leave the gap (the user sees the floor-assert error and has to bump manually).

The Cypress v12 → v13 gap was left intentionally — users get the assert error and bump manually. Don't add a bridge entry without explicit agreement.

## Pre-floor `packageJsonUpdates` entries are intentionally retained

Distinct from the pruned-history case above: a plugin may carry `packageJsonUpdates` entries targeting source majors **below** the current support floor. Example: `@nx/react-native`'s entries `20.3.0` and `21.4.0` target RN versions below the current ~0.79.3 floor. These are intentionally retained for users on older Nx versions that supported older RN.

Don't _add_ a bridge entry without explicit decision. Don't _remove_ a legitimately-pre-floor entry as part of a compliance pass. The W1/W4 audit window only covers entries that target source majors **inside** the current support window.

## `subFloorVersion` must satisfy `lt(clean(it), floor)`

For the parameterized floor spec, pick a value that's actually below the floor after `clean()`. Examples:

| Floor    | Valid `subFloorVersion`        | Invalid                                                                                                                          |
| -------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `19.0.0` | `~18.2.0`, `^18.0.0`, `18.2.0` | `~19.0.0-beta.0` (clean strips the pre-release; in some cases this still satisfies `lt`, but it's confusing — avoid pre-release) |
| `13.0.0` | `~12.17.0`, `^12.0.0`          | `^13.0.0-rc.0`                                                                                                                   |
| `1.36.0` | `~1.35.0`, `^1.35.0`           | `1.36.0-beta.5`                                                                                                                  |

Use a stable minor-or-patch range below floor. Don't use pre-release identifiers.

## Declared floor vs. effective floor

The declared floor (peer dep + `minSupported<Pkg>Version` + `versionMap` lowest entry) is what the plugin advertises. The **effective floor** is the lowest major where every third-party API the plugin's code actually calls is available. When they diverge, the declared floor is lying.

How this happens: someone bumps the plugin to use a new API (e.g., `getRelevantTestSpecifications` introduced in vitest v3) without raising the floor. The plugin compiles, generators pass tests against the latest install lane, but workspaces on sub-effective-floor versions crash at runtime with `... is not a function`.

How to detect: in the audit's runtime/executor inventory step, every `import` / `require` from the third-party package goes into a list. Cross-reference each named export against the third-party's release notes / API docs. The effective floor is the highest "introduced in" version across that list.

How to fix: raise the declared floor to match the effective floor. Drop the now-unsupported entries from `versionMap`, peer, and any per-major aliases. The parameterized floor spec's `subFloorVersion` shifts up accordingly.

Reference: open PR `#35671` (`@nx/vitest`) — proposed v2 floor initially; raised to v3 in a follow-up commit after spotting `getRelevantTestSpecifications` usage. See `anti-patterns.md` §16.

## `versions()` fall-through above ceiling, not throw

Before `#35670`, cypress's `versions()` had a `switch + throw default:`. This is wrong for two reasons:

1. New majors that don't yet have a `versionMap` entry should silently use `latestVersions` — the plugin hasn't been updated to know about them, but the user should still be able to use them.
2. Below-floor is already caught by the generator-level assert. The `versions()` throw is redundant for the in-range/sub-floor case, and wrong for the above-ceiling case.

The pattern is always:

```ts
return versionMap[major as CompatVersions] ?? latestVersions;
```

## Tier-1 chaining in `packageJsonUpdates`

Within a single `packageJsonUpdates` entry (single block), if entry A bumps package X and entry B has `requires: { X: ">=N" }` that depends on the post-bump value of X, B's gate evaluates against the post-bump state. This is **deliberate design**, not a bug.

Concrete example: Storybook's `21.2.0-migrate-storybook-v9` migration is gated on `storybook >=9.0.0` even though the prior state was v8 — the sibling `packageJsonUpdates` `21.1.0` bumps Storybook to v9 first, so the v9 gate evaluates against post-bump state.

This means you can have one block bump X then chain a sibling bump gated on X's new version, without splitting into separate `packageJsonUpdates` keys.

## Cross-plugin coordination of shared third-party windows

Some third-party packages are managed by multiple Nx plugins. Concrete example:

- `@nx/cypress` pins `vite` v5 (for cypress v13) and v6 (for cypress v14+).
- `@nx/vite` supports `vite` v5–v8.

If `@nx/vite` drops v5 from its supported window, `@nx/cypress`'s v5 pin becomes an orphaned install lane — workspaces using both plugins are now in conflict.

When raising / lowering a third-party's support window in one plugin, check every other plugin that manages the same package. The Linear milestone tasks call this out per-plugin (e.g., NXC-4384 cypress flags vite coordination with NXC-4407 vite).

### Sibling declaration consistency

When the same third-party package appears in multiple plugins, the declaration _kind_ (peerDependencies vs dependencies vs devDependencies) should be consistent unless the plugins genuinely have different roles for the package. Concrete inconsistency on master at time of writing: `@module-federation/enhanced ^2.3.3` is in `dependencies` in `@nx/module-federation` but `peerDependencies` in `@nx/rspack`. Pick one rule per package across the plugin family and document the exception when one plugin must differ.

## Plugin must own its primary third-party's pin

A plugin's install constants for its primary third-party must live in the plugin's own `packages/<plugin>/src/utils/versions.ts` — not in another plugin. Cross-plugin imports of install constants create governance drift (the owning plugin can't change the pin without breaking the borrower).

Example anti-pattern: `@nx/esbuild`'s `esbuild` install constant living in `@nx/js`. Flagged in NXC-4386.

## Schema-level deprecated-option stubs with runtime throws

Established Angular pattern (also called out in NXC-4391 jest, NXC-4395 next, NXC-4408 vitest): when an option is deprecated/removed in a newer third-party major but the plugin still supports an older major where it's valid, **retain the option in the schema with a description-notice and throw at runtime when inapplicable to the installed major**.

This keeps the schema accepting the union of options across the support window. Runtime branches on installed version and throws a clear message if the user passes an option that's only valid on a major they're not running.

Reference: search the angular generators for `removed in Angular vN` style schema descriptions paired with `assertSupportedAngularVersion`-aware option handling.

## Known-incomplete plugins

These were touched by a compliance PR but the work is incomplete. Useful for review and for future PRs.

- **`@nx/angular` init `keepExistingVersions`**: `packages/angular/src/generators/init/schema.json` has `default: false` and `packages/angular/src/generators/init/init.ts` passes `options.keepExistingVersions` directly (no `?? true`). PR `#35587` fixed `add-linting` but NOT the init generator. Flag in non-angular PRs as a reference to the pattern; fix in passing in any future angular PR. (Verify state on current master before citing.)
- **`@nx/jest` peer-dep block missing entirely.** When adopting the floor assert, add `peerDependencies` first declaring `jest` / `ts-jest` / `@types/jest` ranges. Without the peer block, `getDependencyVersionFromPackageJson` for `jest` may return `undefined` on installed workspaces because pnpm catalog refs and certain other patterns rely on the peer being declared.
- **Cypress v12→v13 migration gap**: when `#35670` raised the floor to v13, prior v12-cleanup `packageJsonUpdates` entries were already pruned. Decision was to leave it — v12 workspaces see the assert error and bump manually. Reference for the "raise floor, no bridge" pattern.
- **`getInstalled<Pkg>Version` consolidation deferred**: each plugin still has its own near-identical helper (the FS-side has been migrated to the shared helper in some plugins, but a full unification across cypress/playwright/vitest/next/expo/angular is pending). Don't bundle that refactor into a compliance PR.

## `migrate-to-cypress-11` and other intentional sub-floor migrators

A generator whose purpose is to lift sub-floor workspaces onto a supported version must run on sub-floor workspaces. If it had the floor assert, it could never run.

For these generators:

- Do NOT add `assertSupportedXVersion(tree)` to them.
- Keep their existing version checks (e.g., `assertMinimumCypressVersion(8)` in `migrate-to-cypress-11`).
- Add them to `excludeGenerators` in `all-generators-enforce-floor.spec.ts` with a code comment explaining why.

There are usually 0 or 1 of these per plugin. Greater than 1 is suspicious — review carefully.

## `getInstalledPackageVersion` vs. `require('<pkg>/package.json')`

Bare `require('<pkg>/package.json')` resolves from the plugin's own install location, which in pnpm strict mode or nested installs may not match the workspace's resolved version. `readModulePackageJson` (used by `getInstalledPackageVersion`) goes through `getNxRequirePaths()` for correct workspace-rooted resolution.

Anywhere you read an installed version at runtime: prefer `getInstalledPackageVersion('<pkg>')`. Don't `require('<pkg>/package.json')`.

## "Above ceiling" is NOT in the task spec

Repeating because this gets re-introduced: above-ceiling handling is explicitly out of scope for these compliance tasks. If you find yourself adding it, you've drifted from the spec.

The behavior we want above the highest known major: silent fall-through to `latestVersions`. The plugin will be updated to add a `versionMap` entry for the new major in a future PR. Until then, the user gets the latest install constants and may run into incompatibilities, which is the existing pre-compliance behavior. We are NOT trying to detect future majors and warn — that's a different feature.

## Decisions you cannot make alone

Pause and ask when:

- **Peer-range drop:** dropping a major from the peer might be a regression if tests pass on that version. Verify whether the absence of an install lane reflects "we never supported it" (legitimate drop) or "we shipped support and quietly broke it" (regression — investigate before dropping).
- **Floor raise without a bridging migration:** raising the floor by N+ majors means users on the lowest sub-floor major see the assert error and must manually bump. Confirm with the user: acceptable, or add a `packageJsonUpdates` bridge?
- **`requires` removal on a borderline migration:** the diff says the migration is Nx-only (no third-party config touched), but it reads a config file that only exists at certain third-party versions. The third-party dependency is indirect but real. Don't remove the gate without verifying.
- **Peer floor and fresh-install constant diverge** (playwright pattern — peer `^1.36.0`, fresh-install `^1.37.0`). Confirm the gap is justified by feature surface (1.37 introduced the blob reporter + merge-reports CLI) and not an oversight.
- **Ecosystem-locked vs. independent sibling classification:** before adding or removing a sibling's `requires` entry, read its `peerDependencies` block at the version range being bumped from. `@angular-devkit/build-angular` is the gotcha — only peer-locked to `@angular/core` from v20+.
- **Pruned migration gap:** the lowest sub-floor major has no auto-bump path because prior `packageJsonUpdates` entries were removed during cleanup waves. Decide: add a bridge entry, or accept the manual bump? `git log --diff-filter=D -- packages/<plugin>/migrations.json` reveals the gap.
- **New plugin doesn't fit the canonical shape** (manages multiple primary packages with different floors, runs partially as a Nx-internal-only plugin, etc.). Ask before improvising — see `canonical-shape.md` §"Plugins managing multiple primary packages" for the established multi-primary pattern.
- **Test fails on `latest`/`next` despite the assert being a no-op.** The no-op behavior is intentional, but if the generator downstream of the assert can't handle the unresolved range, that's a real bug — not something to paper over by tightening the assert.

## Per-plugin decision log

These were decided once for the reference PRs (#35587, #35642, #35670) — apply them as defaults unless explicitly contradicted by the user for a new plugin:

- **Executors do NOT enforce the plugin floor.** Generator-only. Executors gate per-feature, not per-floor.
- **Above-ceiling: silent fall-through to `latestVersions`.** No warn, no throw, no branch.
- **Init generators preserve user pins** via `keepExistingVersions: true` (schema default) and the `?? true` safety net at the call site.
- **Skip writing the install constant when the package is already detected** (cypress + angular pattern — preserves the user's installed minor/patch).
- **Shared helpers stay in `@nx/devkit/internal`** — not part of the public devkit surface. (The W2 ticket originally proposed adding `throwForUnsupportedVersion` to the public devkit API; the implementation landed under `/internal` instead, matching how other version-related helpers ship.)
- **Consolidation of per-plugin `getInstalled<Pkg>Version` helpers is deferred** — don't bundle that refactor into a compliance PR.

Plugin-specific decisions that may be pending or have settled differently (check the live PR state via `gh pr list --repo nrwl/nx --search "multi-version compliance"`):

- `@nx/jest` — needs a `peerDependencies` block for `jest`/`ts-jest`/`@types/jest` before the floor assert can rely on `getDependencyVersionFromPackageJson`.
- `@nx/eslint` — historically gated on an ESLint v8 EOL decision. If you're touching it, confirm the decision is settled.
- `@nx/eslint-plugin` — historically coupled to the eslint v8 decision (typescript-eslint v6/v7 only support eslint v8). Confirm before proceeding.
- `@nx/rspack` / `@nx/rsbuild` — there is an open PR (`#35676` at time of writing). Inspect for the local-helper-duplication anti-pattern (`anti-patterns.md` §1).

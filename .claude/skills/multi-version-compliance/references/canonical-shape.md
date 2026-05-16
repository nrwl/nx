# Canonical shape

What a compliant plugin looks like. Don't deviate without a documented reason.

The first half of this file ("How to write") describes the canonical structure
you produce in fix mode. The tail section ("Code-level verification") is the
review-mode lens — markers to look for in a diff.

## Shared helpers (already merged — use, don't duplicate)

### `@nx/devkit/internal`

Source: `packages/devkit/src/utils/version-floor.ts` and `packages/devkit/src/utils/installed-version.ts`.

```ts
// version-floor.ts
function throwForUnsupportedVersion(
  packageName: string,
  installedVersion: string,
  floor: string
): never;

function assertSupportedPackageVersion(
  tree: Tree,
  packageName: string,
  minSupportedVersion: string
): void;
```

```ts
// installed-version.ts
function getInstalledPackageVersion(packageName: string): string | null;

function getDeclaredPackageVersion(
  tree: Tree,
  packageName: string,
  latestKnownVersion?: string
): string | null;

const NON_SEMVER_DIST_TAGS = ['latest', 'next'] as const;
function isNonSemverDistTag(version: string): version is NonSemverDistTag;
function normalizeSemver(version: string): string | null;
```

When to use which:

| Context                          | Function                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| Generator entry (assert floor)   | `assertSupportedPackageVersion(tree, pkg, floor)`                                   |
| Generator-time version branching | `getDeclaredPackageVersion(tree, pkg, latestKnownVersion)`                          |
| Executor / runtime / preset      | `getInstalledPackageVersion(pkg)`                                                   |
| Anywhere                         | `isNonSemverDistTag`, `normalizeSemver`                                             |
| Never                            | `throwForUnsupportedVersion` directly — it's an implementation detail of the assert |

### `@nx/devkit/internal-testing-utils`

Source: `packages/nx/src/internal-testing-utils/assert-generators-enforce-version-floor.ts`.

```ts
function assertGeneratorsEnforceVersionFloor(options: {
  packageRoot: string;
  packageName: string;
  subFloorVersion: string;
  excludeGenerators?: string[];
}): void;
```

Behavior: reads `generators.json` from `packageRoot`, iterates every entry, loads its factory, calls it against a tree with `{ [packageName]: subFloorVersion }` in `package.json`, expects a throw matching `Unsupported version of \`${packageName}\` detected`.

`excludeGenerators` is only for intentional sub-floor migrators (e.g., `migrate-to-cypress-11`). Comment the reason next to the array.

## Finding the existing floor (audit input)

When auditing a plugin you haven't touched before, the floor may not be declared in one place. Check, in order of authority:

1. **`minSupported<Pkg>Version` constant in `versions.ts`** — if it exists, that's the declared floor.
2. **`peerDependencies` lowest range in `package.json`** — what the plugin advertises supporting.
3. **Lowest major in `versionMap` / `backwardCompatibleVersions` / `supportedVersions`** — what the plugin has install lanes for.
4. **Lowest `packageJsonUpdates` entry that touches the third-party package** — historical evidence of the supported range.
5. **Highest API requirement in the plugin's own code (the _effective_ floor).** Grep for every `import` / `require` from the third-party package and identify which APIs are called. Cross-reference each against the third-party's changelog. The plugin's effective floor is the lowest major where **all** called APIs exist. **This trumps the declared floor** — if `versions.ts` claims v2 but the plugin imports an API only available in v3+, the declared floor is wrong.

These should agree. When they don't, the disagreement is the finding (phantom peer claim, drifted versionMap, declared floor below effective floor).

**Worked example:** During open PR `#35671`, the audit initially landed on a `v2.0.0` floor (matching the lowest install lane). Then a follow-up commit dropped the floor to `v3.0.0` after noticing the plugin's atomization code calls `getRelevantTestSpecifications`, which is a vitest v3+ API. Lesson: step 5 above is not optional. Always check what APIs the plugin's own runtime code uses — `versions()` having a v2 lane doesn't mean the plugin actually works on v2.

## The plugin wrapper (one per plugin)

Path: `packages/<plugin>/src/utils/assert-supported-<pkg>-version.ts`.

Two canonical shapes:

### Single-major floor (most plugins)

```ts
import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { minSupportedCypressVersion } from './versions';

export function assertSupportedCypressVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'cypress', minSupportedCypressVersion);
}
```

Reference: `packages/cypress/src/utils/assert-supported-cypress-version.ts`, `packages/playwright/src/utils/assert-supported-playwright-version.ts`.

### Floor derived from supported-versions list (angular)

```ts
import { type Tree } from '@nx/devkit';
import { assertSupportedPackageVersion } from '@nx/devkit/internal';
import { supportedVersions } from './backward-compatible-versions';

const minSupportedAngularMajor = Math.min(...supportedVersions);

export function assertSupportedAngularVersion(tree: Tree): void {
  assertSupportedPackageVersion(
    tree,
    '@angular/core',
    `${minSupportedAngularMajor}.0.0`
  );
}
```

Reference: `packages/angular/src/utils/assert-supported-angular-version.ts`.

Pick the shape that matches whether the plugin already has a `supportedVersions` list (angular does; cypress/playwright/vitest don't).

### Plugins managing multiple primary packages

`@nx/jest` manages `jest`, `ts-jest`, `@types/jest`. `@nx/eslint` manages `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-config-prettier`. The canonical wrapper signature takes one package; with multiple, decisions are needed:

- **Gate on the primary only** when the others are peer-locked (e.g., angular's strategy with `@angular/core` covering `@angular/cli`, `@angular/ssr`, etc.). This is sufficient when the siblings' peer-deps tie them to the primary's major.
- **Gate on each independently** when the siblings can be installed at any major regardless of the primary (typescript-eslint pair vs eslint; ts-jest vs jest). In that case, the wrapper makes multiple `assertSupportedPackageVersion` calls in sequence:

```ts
export function assertSupportedJestVersion(tree: Tree): void {
  assertSupportedPackageVersion(tree, 'jest', minSupportedJestVersion);
  // ts-jest is independent — declare and assert it separately.
  assertSupportedPackageVersion(tree, 'ts-jest', minSupportedTsJestVersion);
}
```

When in doubt: read each sibling's `peerDependencies` block at the version range being supported. If it pins the primary, it's covered by the primary's gate. If it doesn't (or pins something else), it needs its own.

## Skip writing the install constant when the package is already detected

Init generators that add the third-party package to `package.json` should NOT overwrite an already-installed minor/patch. The `keepExistingVersions: true` flag handles this at the `addDependenciesToPackageJson` level. But for code paths that compute the version to write (e.g., picking the major-specific value from `versionMap`), the rule is the same: read what's installed first; only write the fresh-install constant when nothing is detected.

Reference: `packages/cypress/src/generators/init/init.ts` `updateDependencies` — calls `getInstalledCypressVersion(tree)` first, then routes through `versions(tree)` which short-circuits to existing-version paths. The `keepExistingVersions ?? true` flag at the `addDependenciesToPackageJson` call site is the final safety net.

## The versions module

Path: `packages/<plugin>/src/utils/versions.ts`.

### Required exports

```ts
// Plain string, no caret. Used as the floor for assertSupportedPackageVersion.
export const minSupportedCypressVersion = '13.0.0';

// Fresh-install constants — may be HIGHER than minSupported when the feature
// surface at the floor is incomplete. Playwright peer is ^1.36.0 but
// fresh-install is ^1.37.0 so blob reporter + merge-reports work out of the
// box.
export const playwrightVersion = '^1.37.0';

// Optional: feature-gate thresholds for runtime/executor code.
export const minPlaywrightVersionForBlobReports = '1.37.0';
```

### Stable deps stay top-level; per-major-varying deps go in the bundle

A plugin typically manages one primary package whose version map drives several siblings. Deps that vary per major go into a typed bundle; deps that are version-stable stay as plain `export const`s.

```ts
// Stable across all supported majors of the primary → plain exports.
export const viteVersion = '^8.0.0';
export const jsdomVersion = '^27.1.0';
export const vitePluginReactVersion = '^6.0.0';

// Vary with the primary's major → bundle.
export const vitestVersion = '~4.1.0';
export const vitestCoverageV8Version = '~4.1.0';
export const vitestCoverageIstanbulVersion = '~4.1.0';

type VitestVersions = {
  vitestVersion: string;
  vitestCoverageV8Version: string;
  vitestCoverageIstanbulVersion: string;
};

// latestVersions reuses the top-level exports so import { vitestVersion }
// stays valid for the fresh-install path while versions(tree).vitestVersion
// is the route-aware version.
const latestVersions: VitestVersions = {
  vitestVersion,
  vitestCoverageV8Version,
  vitestCoverageIstanbulVersion,
};

type CompatVersions = 3;
const versionMap: Record<CompatVersions, VitestVersions> = {
  3: {
    vitestVersion: '^3.0.0',
    vitestCoverageV8Version: '^3.0.5',
    vitestCoverageIstanbulVersion: '^3.0.5',
  },
};
```

**Do not** keep per-major aliases like `vitestV3Version = '^3.0.0'` alongside the bundle — they duplicate the map entries and drift over time. See `anti-patterns.md` §15.

### The `versions(tree)` function

Falls through to latest on unknown majors — no `switch + throw default:`.

```ts
export function versions(tree: Tree): VitestVersions {
  const installedVitestVersion = getInstalledVitestVersion(tree);
  if (!installedVitestVersion) {
    return latestVersions;
  }
  const vitestMajorVersion = major(installedVitestVersion);
  return versionMap[vitestMajorVersion as CompatVersions] ?? latestVersions;
}
```

### The `getInstalled<Pkg>Version(tree?)` helper

Optional `tree` parameter — with tree, reads declared from `package.json` (normalizing `latest`/`next` to the fresh-install constant); without tree, routes through the shared `getInstalledPackageVersion` from `@nx/devkit/internal` (FS resolution via `getNxRequirePaths()`).

```ts
export function getInstalledVitestVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('vitest');
  }

  const installedVersion = getDependencyVersionFromPackageJson(tree, 'vitest');
  if (!installedVersion) {
    return null;
  }
  if (installedVersion === 'latest' || installedVersion === 'next') {
    return clean(vitestVersion) ?? coerce(vitestVersion)?.version ?? null;
  }
  return clean(installedVersion) ?? coerce(installedVersion)?.version ?? null;
}

export function getInstalledVitestMajorVersion(tree?: Tree): number | null {
  const installedVitestVersion = getInstalledVitestVersion(tree);
  return installedVitestVersion ? major(installedVitestVersion) : null;
}
```

This is the cypress/playwright/vitest pattern. Reference: `packages/cypress/src/utils/versions.ts`.

## Generator entry points

The assert goes in the function that does the actual work — first statement of the function body, before any other tree access or sub-generator call. (The assert itself reads the tree, of course; the rule is that nothing else in the generator runs against an unsupported version.)

### Plugins with a `<gen>` / `<gen>Internal` split (cypress, playwright)

The public wrapper merges defaults and delegates. Assert lives in `*Internal`:

```ts
// Public wrapper — no assert, just default merging.
export async function cypressInitGenerator(tree: Tree, options: Schema) {
  return cypressInitGeneratorInternal(tree, { addPlugin: false, ...options });
}

// Working function — assert is the first statement.
export async function cypressInitGeneratorInternal(
  tree: Tree,
  options: Schema
) {
  assertSupportedCypressVersion(tree);

  updateProductionFileset(tree);
  // ...
}
```

Reference: `packages/cypress/src/generators/init/init.ts`, `packages/playwright/src/generators/init/init.ts`.

### Plugins with a single-function generator (angular)

No wrapper/internal split. The function itself asserts:

```ts
export async function angularInitGenerator(tree: Tree, options: Schema) {
  assertSupportedAngularVersion(tree);
  // ...
}
```

Reference: `packages/angular/src/generators/init/init.ts`.

### Double-asserts are established convention, not an edge case

When `configurationGenerator` calls `initGenerator` internally, both call their respective `assertSupportedXVersion`. This is the angular precedent (29 `generators.json` entries → 58 assert call sites). The assert is idempotent (one tree read + one semver comparison) and the parameterized floor spec treats every entry point as independent — both must throw on sub-floor. Don't refactor away.

## User-pin preservation

### `addDependenciesToPackageJson` call sites

Every call from a generator (NOT a migration) must pass `keepExistingVersions: true` as the fifth positional argument or via the `?? true` pattern.

```ts
// Pattern A — explicit at the call site
addDependenciesToPackageJson(
  tree,
  {},
  { 'eslint-plugin-cypress': pkgVersions.eslintPluginCypressVersion },
  undefined,
  true
);

// Pattern B — driven by schema (init generators only)
addDependenciesToPackageJson(
  tree,
  {},
  devDependencies,
  undefined,
  options.keepExistingVersions ?? true
);
```

Reference: `packages/cypress/src/generators/init/init.ts`, `packages/cypress/src/utils/add-linter.ts`, `packages/angular/src/generators/add-linting/lib/add-angular-eslint-dependencies.ts`.

### init schema

```json
{
  "keepExistingVersions": {
    "type": "boolean",
    "x-priority": "internal",
    "description": "Keep existing dependencies versions",
    "default": true
  }
}
```

Reference (on master): `packages/cypress/src/generators/init/schema.json`, `packages/playwright/src/generators/init/schema.json`. (`@nx/vitest` follows the same pattern in its open PR — verify via `gh pr diff 35671`.)

## Migrations.json gates

Three categories of migration:

| Category                         | Touches                                           | `requires`                                                                  |
| -------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- |
| Nx-only                          | `nx.json`, executor options, generator defaults   | none                                                                        |
| Codemod                          | source files / config tied to a third-party major | `{ "<pkg>": ">=N <N+1" }` (or open upper bound for legacy-cleanup codemods) |
| `packageJsonUpdates` cross-major | bumps `<pkg>` from major N to N+1                 | `{ "<pkg>": ">=N.0.0 <(N+1).0.0" }` (source-major gate)                     |
| `packageJsonUpdates` same-major  | bumps minor/patch                                 | none required                                                               |

### Sibling packages

Ecosystem-locked siblings whose peer-on-the-primary covers them: no separate `requires`. Examples in Angular: `@angular/cli`, `@angular/ssr`, `@angular-devkit/build-angular` (from v20+, NOT v19).

Independent siblings: each needs its own `requires` entry. Examples in Angular: `@ngrx/*`, `@angular-eslint/*`, `zone.js`, `jest-preset-angular`.

### Reference examples

- `packages/angular/migrations.json` `20.2.0-module-federation`, `22.2.0`, `22.6.0-module-federation` — Module Federation entries gating on `@module-federation/enhanced` source range. Added in `#35587`.
- `@nx/vitest`'s `update-22-1-0` and `update-22-3-2` migrations gating on `vitest: ">=4.0.0"` (Vitest-4-specific AI-instructions) — pattern proposed in open PR `#35671`. Inspect via `gh pr diff 35671 --repo nrwl/nx -- packages/vitest/migrations.json`.
- `packages/angular/migrations.json` `update-unit-test-runner-option` — Nx-only migration with the over-gating `@angular/core` `requires` **removed** in `#35587`.

## Test specs

### Parameterized floor spec (one per plugin)

Path: `packages/<plugin>/src/utils/all-generators-enforce-floor.spec.ts`.

```ts
import { assertGeneratorsEnforceVersionFloor } from '@nx/devkit/internal-testing-utils';
import { join } from 'node:path';

describe('@nx/<plugin> generators enforce supported version floor', () => {
  assertGeneratorsEnforceVersionFloor({
    packageRoot: join(__dirname, '..', '..'),
    packageName: '<pkg>',
    subFloorVersion: '~<floor-minus-one>',
    // Required only when a generator must run below the floor by design.
    // excludeGenerators: ['migrate-to-cypress-11'],
  });
});
```

Pick `subFloorVersion` such that `lt(coerce(it).version, floor)` is true. No pre-release identifiers. Reference values used in the repo: `~18.2.0` (angular, v19 floor), `~12.17.0` (cypress, v13 floor), `~1.35.0` (playwright, v1.36 floor).

### Plugin assert spec (optional, one per plugin)

Path: `packages/<plugin>/src/utils/assert-supported-<pkg>-version.spec.ts`.

`assertSupportedPackageVersion` is already fully tested in `@nx/devkit`,
so a per-plugin spec mostly re-tests the shared helper. The early
compliance PRs (`#35587` angular onward) ship one for symmetry, but it
isn't required. If you add one, five canonical cases is the shape used:

```ts
describe('assertSupportedCypressVersion', () => {
  it('throws when cypress is below the supported floor');
  it('does not throw when cypress is not installed (fresh-install path)');
  it('does not throw when cypress is `latest`');
  it('does not throw when cypress is `next`');
  it('does not throw when cypress is within the supported window');
});
```

Reference: `packages/angular/src/utils/assert-supported-angular-version.spec.ts` (originally landed in `#35587`).

### Test message matching

Use substring match on the error message:

```ts
.rejects.toThrow(`Unsupported version of \`${packageName}\` detected`)
```

Not a hand-rolled RegExp (avoid escape bugs). Reference: see how the shared `assertGeneratorsEnforceVersionFloor` itself does the match — search for `Unsupported version of` in `packages/nx/src/internal-testing-utils/assert-generators-enforce-version-floor.ts`.

## Standardized error format

```
Unsupported version of `<pkg>` detected.

  Installed: <declared-range-as-written-in-package.json>
  Supported: >= <floor>

Update `<pkg>` to <floor> or higher.
```

Two notes:

- The `Installed:` line preserves the **original declared range** (e.g., `~18.2.0`), not the cleaned semver. `assertSupportedPackageVersion` passes `declared` through to `throwForUnsupportedVersion`.
- Do not add an "above ceiling" branch to this message. Above-ceiling is silent fallthrough.

## Peer dep alignment

### What belongs in `peerDependencies`

The test: _would the plugin still work if this package were absent from the workspace, with the plugin's code paths unchanged?_

A package is required-peer if **any** of these is true:

- The plugin's TypeScript imports / `require`s it (executor, preset, runtime helper).
- The plugin's executor spawns its CLI binary (`spawn('cypress')`, etc.).
- The plugin's inferred plugin (`createNodes`/`createNodesV2`) **emits a target whose `command` invokes the package's CLI** (e.g., `command: 'rspack build'` → `@rspack/cli` is required). The `externalDependencies: ['<pkg>']` declaration in such targets is itself an admission of the runtime dependency.

A package is **not** required-peer when:

- The plugin's generator installs it into the user's workspace for the user to consume independently, and no plugin code (TypeScript, executor binary spawn, or inferred-plugin emitted command) ever invokes it. Example: ESLint plugins written into the user's eslintrc — `@nx/cypress` installs `eslint-plugin-cypress`, but its lint executor uses generic ESLint loading; the cypress plugin is loaded by ESLint per the user's config, not by `@nx/cypress`. Example: `@types/*` packages installed for the user's TS compilation but never imported by plugin code.

**Ecosystem-signal peer** (Angular's full `@angular/*` peer list) → judgment call, not a compliance requirement. Documents lockstep compatibility but isn't enforced by the multi-version rules.

### Required vs. optional peer

Most Nx plugin peers should be **optional** (`peerDependenciesMeta: { "<pkg>": { "optional": true } }`):

- Required peer: every user of the plugin needs this package, regardless of which surface they use. Example: `@angular-devkit/core`, `rxjs` in `@nx/angular` — every Angular Nx workspace uses them.
- **Optional peer (the common case for inferred-plugin / executor surfaces):** the package is only needed when the user opts into a specific surface — an executor they have to write into `project.json`, an inferred plugin gated on the presence of a config file, a preset that auto-injects. Users who don't use that surface shouldn't see an unmet-peer warning. Examples: `@playwright/test` in `@nx/playwright`, `cypress` in `@nx/cypress`, `vitest` / `vite` in `@nx/vitest`, `@angular/build` / `@angular-devkit/build-angular` / `ng-packagr` in `@nx/angular`.

For `@rspack/cli` / `@rspack/core` in `@nx/rspack`: both surfaces (executor, inferred plugin) are gated — executor opt-in via `project.json`, inferred plugin gated on `rspack.config.{ts,js}` presence. Compliance fix should peer-declare both with `optional: true`.

Concrete examples:

| Package                 | Plugin           | Plugin invokes?                                                                                                                                                  | Peer?   | Optional?                                             |
| ----------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------- |
| `cypress`               | `@nx/cypress`    | yes (executor spawns binary; inferred plugin emits `cypress run` commands)                                                                                       | **yes** | optional (executor + inferred plugin are both opt-in) |
| `@playwright/test`      | `@nx/playwright` | yes (executor + preset + inferred plugin)                                                                                                                        | **yes** | optional                                              |
| `vitest`                | `@nx/vitest`     | yes (executor + inferred plugin emits `vitest` commands)                                                                                                         | **yes** | optional                                              |
| `@rspack/cli`           | `@nx/rspack`     | yes — inferred plugin emits `command: 'rspack build'` (`packages/rspack/src/plugins/plugin.ts:182,196`). Not imported in TS, but invoked via emitted CLI target. | **yes** | optional (both surfaces gated)                        |
| `@angular-devkit/core`  | `@nx/angular`    | yes (used by every Angular Nx workspace)                                                                                                                         | **yes** | **not optional**                                      |
| `@angular/build`        | `@nx/angular`    | yes (only when user uses the @angular/build builder)                                                                                                             | **yes** | optional                                              |
| `eslint-plugin-cypress` | `@nx/cypress`    | no (generator writes it into user's eslintrc; ESLint loads it, not the plugin)                                                                                   | **no**  | n/a                                                   |
| `@types/node`           | various          | no (generator install only; types are build-time)                                                                                                                | **no**  | n/a                                                   |

### Range / version alignment

For packages that ARE peer-declared: the range must match the install lanes the code ships. If the code has no `isV1Installed` branch and no v1 entry in `versionMap`, do not list `^1.0.0` in the peer range.

Reference: open PR `#35671` (`@nx/vitest`) drops `^1.0.0` from the `vitest` peer range because there is no v1 install lane. Inspect via `gh pr diff 35671 --repo nrwl/nx -- packages/vitest/package.json`. Verify state — may have merged or closed since.

## Executor / runtime feature gating

Features introduced after the floor must gate at call time on the installed version, not on the floor. Use `getInstalledPackageVersion` + `lt` from `semver`.

```ts
import { getInstalledPackageVersion } from '@nx/devkit/internal';
import { lt } from 'semver';
import { minPlaywrightVersionForBlobReports } from './versions';

const installed = getInstalledPackageVersion('@playwright/test');
if (installed && lt(installed, minPlaywrightVersionForBlobReports)) {
  throw new Error(
    `The "@nx/playwright:merge-reports" executor requires "@playwright/test" version ${minPlaywrightVersionForBlobReports} or greater (the version that introduced the "blob" reporter and the "merge-reports" CLI). You are currently using version ${installed}.`
  );
}
```

Reference: `packages/playwright/src/executors/merge-reports/merge-reports.impl.ts`, `packages/playwright/src/utils/preset.ts`. Both added in `#35642`.

Two distinct cases:

- **Auto-injected feature** (preset's auto-blob in CI): skip injection silently when installed < threshold. Only throw when the user explicitly opted in (`generateBlobReports: true`) on an unsupported version.
- **Direct invocation** (executor CLI subcommand): throw immediately with a clear "requires >= X.Y.Z (the version that introduced …)" message.

## File-layout summary

For plugin `@nx/<plugin>` managing `<pkg>` with floor `X.Y.Z`:

```
packages/<plugin>/
  src/
    utils/
      versions.ts                                # add minSupportedXVersion
      assert-supported-<pkg>-version.ts          # NEW — 7-line wrapper
      assert-supported-<pkg>-version.spec.ts     # OPTIONAL — 5 cases (mostly re-tests shared helper)
      all-generators-enforce-floor.spec.ts       # NEW — parameterized
    generators/
      <each>/
        <each>.ts                                # assert as first statement
      init/
        schema.json                              # keepExistingVersions default: true
        init.ts                                  # keepExistingVersions ?? true
    executors/                                   # feature-gate via getInstalledPackageVersion
    plugins/                                     # same
  migrations.json                                # tighten / remove `requires` gates per audit
  package.json                                   # align peer; add "semver": "catalog:" if newly used
```

---

# Code-level verification (review-mode lens)

In review mode, walk these markers against the diff.

Output rules:

- **Inline categories are `[blocker]` and `[non-blocker]` only.** No "open question," "ask," or other ad-hoc tags. Author-directed questions emerge from non-blocker findings and surface in the closing "Open questions for author" block.
- **For each blocker / non-blocker:** anchor at `file:line` and cite which reference PR / file demonstrates the correct pattern. Cross-reference `anti-patterns.md` when the finding matches a numbered pattern.
- **Sections without findings get a single summary line**, not a per-file enumeration. `"Pass — all 7 generator entries assert at first statement"` is right; listing seven file:lines is wrong. Reviewer time is spent on actionable items; passing checks should not eat reading budget.
- **Produce the verdict block** at the end (see §"Verdict template"). The block is the skimmable index — produce it, don't substitute a free-form summary.

Scope:

- **In scope:** the diff's code, configs, schemas, migrations, and **in-codebase documentation that describes runtime behavior** (e.g., `.mdoc` / `.md` files under `astro-docs/` or `docs/` that claim how the plugin behaves). A docs claim that contradicts the code is a correctness issue and belongs here.
- **Out of scope:** PR title, PR body shape, commit message format, related-issues section, branch naming. Defer to the user's PR/commit conventions (loaded globally from `~/.claude/memory/workflow/git/`). Don't flag PR/commit shape in this skill's review output.

## 1. Peer dep & install constants

- [blocker] `package.json` peer dep range matches the install lanes implemented in `versions.ts`. No phantom version claims. → If `versionMap` has no v1 entry, peer must not list `^1.0.0`. Reference correction: `#35671` (`@nx/vitest`). Anti-pattern: §8.
- [blocker] **Declared floor matches the effective floor.** Grep every `import` / `require` from the third-party package in plugin code. If any imported API only exists at version >N, the declared floor must be >=N. Anti-pattern: §16. Reference correction: `#35671` second commit raised vitest from v2 to v3 after catching a `getRelevantTestSpecifications` import (v3+ only).
- [blocker] Fresh-install constant exposes the **full feature surface**, not just the peer floor. → Playwright peer stayed `^1.36.0` but fresh-install moved to `^1.37.0` because blob reporter + `merge-reports` CLI both require 1.37. Reference: `#35642` `packages/playwright/src/utils/versions.ts`.
- [blocker] No per-major version aliases (`<pkg>V3Version`, `<pkg>V4Version`, etc.) alongside a `versionMap` — pick one source of truth. Anti-pattern: §15. Reference: `#35671`'s third commit dropped these aliases.
- [blocker] `versions.ts` exports `minSupportedXVersion = 'X.Y.Z'` as a plain string (no caret, no range markers). The wrapper passes this verbatim to `assertSupportedPackageVersion`.
- [blocker] `versionMap[major]` lookup is `versionMap[major] ?? latestVersions`. No `switch + throw default:` or other above-ceiling throw. Anti-pattern: §2. Reference correction: `#35670` (`@nx/cypress` `versions()` rewrite).
- [blocker] Every third-party package the **plugin invokes at runtime** has a `peerDependencies` entry. "Invokes" covers: (a) TypeScript `import`/`require`, (b) executor spawning the package's CLI binary, (c) inferred-plugin (`createNodes`/`createNodesV2`) emitting a target whose `command` invokes the package's CLI (the `externalDependencies: ['<pkg>']` field on such targets confirms the dependency). See §"Peer dep alignment" for the full categorization.
  - **Don't flag** packages the plugin's generator installs into the user's workspace for the user to consume independently, with no plugin codepath invoking them (e.g., ESLint plugins like `eslint-plugin-cypress` that ESLint loads from the user's eslintrc; `@types/*` packages).
  - Plugins flagged at time of writing for actually-invoked packages without a peer entry: `@nx/webpack`, `@nx/rollup`, `@nx/angular-rspack-compiler` (primary listed under `dependencies`); `@nx/jest`, `@nx/nest`, `@nx/module-federation`, `@nx/react`, `@nx/vue`, `@nx/expo`, `@nx/react-native`, `@nx/node`, `@nx/js` (verify per plugin — TS imports, binary spawns, AND inferred-plugin emitted commands all count).
- [blocker] Peers that are only used when the user opts into a specific surface (executor opt-in, inferred plugin gated on config file presence, opt-in preset) are declared **optional** via `peerDependenciesMeta: { "<pkg>": { "optional": true } }`. Pattern is established across reference plugins — `@playwright/test`, `cypress`, `vitest`, `vite`, `@angular/build`, `ng-packagr` are all optional. Required-non-optional peers (`@angular-devkit/core`, `rxjs` in `@nx/angular`) are reserved for packages every workspace using the plugin needs. See §"Required vs. optional peer".
- [non-blocker] If the PR introduces `semver` usage in the plugin, `package.json` `dependencies` lists `"semver": "catalog:"`. Reference: `#35642` added it to `packages/playwright/package.json`.

## 2. Generator entry points

- [blocker] **Every** entry in `generators.json` has its working function calling `assertSupported<Pkg>Version(tree)` as the **first statement** — before any tree reads, writes, or sub-generator calls. For wrapper/internal-split plugins (cypress, playwright): assert is in `*Internal`. For single-function generators (angular): in the function itself. Anti-pattern: §14.
- [blocker] Plugin wrapper file `assert-supported-<pkg>-version.ts` imports `assertSupportedPackageVersion` from `@nx/devkit/internal`. No direct call to `throwForUnsupportedVersion`. No bespoke `throwBelowFloor` / `throwAboveWindow` / `assertVersion` / local `cleanVersion = clean(v) ?? coerce(v)?.version` helpers (use `normalizeSemver` / `getInstalledPackageVersion` / `getDeclaredPackageVersion`). Anti-pattern: §1. Concrete example: PR `#35676` introduces a local `cleanVersion` and `getInstalledRsbuildVersionRuntime` — both already exist as shared helpers.
- [blocker] If `all-generators-enforce-floor.spec.ts` uses `excludeGenerators`, each excluded name has a code comment explaining why the generator must run sub-floor (e.g., `migrate-to-cypress-11` lifts v8–v10 workspaces onto v11).
- [non-blocker] Double-assert chains (`configurationInternal` calls `initInternal`, both assert) are OK. Idempotent. Don't refactor away.

## 3. Generator outputs

- [blocker] Templates the generator writes (project files, configs, schemas) compile and run on every major in the support window. Verify with a quick mental walk: for each template referenced from the generator, identify any per-major-version conditional and confirm it's accurate.
- [blocker] Generated `project.json` target shape (executor, options, schema) is valid on every supported major. If the executor's option schema differs across the support window, the generator branches or uses the union shape.
- [blocker] Default option values are valid on every supported major. A default that's only valid above a specific major must be conditional.
- [blocker] Version map covers every managed third-party dep. If the runtime later branches on a sibling's version (e.g., `@vitest/ui`), the version map must have an entry for that sibling per major — no gaps where the generator picks a constant the runtime then can't reconcile.
- [blocker] Generator schema accepts the **union of options across the support window**. Options removed in a newer major still validate at schema level (with description-notice); runtime throws when inapplicable on the installed major. See `gotchas.md` §"Schema-level deprecated-option stubs with runtime throws".

## 4. `keepExistingVersions` (user-pin preservation)

- [blocker] Every `addDependenciesToPackageJson` call from a **generator** passes `keepExistingVersions: true` (positionally as the 5th arg) or `options.keepExistingVersions ?? true`.
- [blocker] `init/schema.json` has `"keepExistingVersions": { "default": true }`. Not `false`. Not absent. **Known gap:** `@nx/angular`'s init schema currently has `default: false` and was NOT addressed in `#35587` — flagging in a non-angular PR is correct; fixing in passing in an angular PR is also correct. Anti-pattern: §4.
- [blocker] Linter / sub-generator helpers (`add-linter.ts`, `add-angular-eslint-dependencies.ts`, equivalents) also pass `true`.
- [non-blocker] If both schema `"default": true` AND `options.keepExistingVersions ?? true` are present, that's two sources of truth. Anti-pattern: §12.
- **Migration generators are exempt.** Do not flag missing flags in code under `src/migrations/`.

## 5. `migrations.json` gates

- [blocker] Every `packageJsonUpdates` entry that bumps across a major version has `requires: { "<pkg>": ">=N.0.0 <(N+1).0.0" }`. Source-major gate, not target. Anti-pattern: §6. Reference: `#35587` Module Federation entries.
  - **Read the actual range strings; don't tick this by counting split entries.**
  - [non-blocker / ask author] One-sided gates (`<X` with no lower bound, or `>=Y` with no upper bound) may be intentional or accidental. Legitimate cases: legacy-cleanup codemods that should apply on every source major below the target; a v0→v1 bridge where every v0.x workspace should migrate; bumping a package introduced at vN from `undefined`. Illegitimate cases: a v1→v2 bump expressed as `<2.x` would fire for v0 workspaces too; a `>=N` with no upper bound would fire for future majors. **When you see a one-sided gate, ask the author to confirm intent** — don't auto-flag as blocker.
- [blocker] Codemod migrations that only make sense at/above a specific third-party major have a `requires` entry. Open upper bound is intentional when the codemod cleans up legacy flags. Runtime per-package guards (`gte`/`lt` inside the migration body) are NOT a substitute for `requires`.
- [blocker] **Nx-only migrations have NO `requires` gate.** A migration that only writes to `nx.json`, executor options, or generator defaults applies regardless of third-party version. Anti-pattern: §5. Reference correction: `#35587` removed the over-gating `@angular/core: >=21.0.0` from `update-unit-test-runner-option`.
- [blocker] For independent siblings (Angular: `@ngrx/*`, `@angular-eslint/*`, `zone.js`, `jest-preset-angular`), gating on the primary's major is **not sufficient** — each needs its own `requires` entry. Anti-pattern: §7. Verify pairing by reading the sibling's `peerDependencies` at the version range being bumped from.
- [blocker] A single `packageJsonUpdates` entry must not mix mutually-exclusive cross-major bumps under one `requires` (AND-semantics). Split into separate entries each with its own gate. Concrete example: React PR's `22.3.4` entry mixed `react-router 7.12.0` (cross-major) with `react-router-dom 6.30.3` (v6 patch) — must split.
- [non-blocker] `incompatibleWith` is not a substitute for `requires`. Anti-pattern: §10. If you see `incompatibleWith` standing in for a source-major gate, ask for a `requires` instead.
- [non-blocker] Sibling `packageJsonUpdates` entries within the same block that depend on a peer's post-bump version are fine — tier-1 chaining evaluates against post-bump state. Reference: Storybook 21.2.0 chains on the prior 21.1.0 bump.
- [non-blocker] Pre-floor `packageJsonUpdates` entries targeting source majors below the current support floor are intentionally retained for users on older Nx versions. Don't _add_ a bridge entry without explicit decision, and don't _remove_ a legitimately-pre-floor entry mid-audit.

## 6. Executor / runtime / inferred-plugin feature gating

- [blocker] Executor code that invokes a CLI subcommand or uses an API introduced after the floor calls `getInstalledPackageVersion('<pkg>')` + `lt(installed, threshold)` from `semver` and throws a clear "requires >= X.Y.Z (the version that introduced …)" message. Reference: `packages/playwright/src/executors/merge-reports/merge-reports.impl.ts` (`#35642`).
- [blocker] Preset / config builders that auto-inject feature-version-coupled config skip injection silently when installed < threshold, and only throw when the user **explicitly** opted in on an unsupported version. Reference: `packages/playwright/src/utils/preset.ts` (`#35642` — `generateBlobReports` logic).
- [blocker] **Inferred plugins** (`createNodes`/`createNodesV2`) parse configs across every major in the support window. The plugin emits the same target shape regardless of the installed major (or branches if shapes diverge). Don't hardcode helper imports against one major.
- [blocker] **Above-ceiling is silent fallthrough.** No warn, no throw, no branch. Anti-pattern: §2.
- [non-blocker] Executors don't enforce the plugin floor. Floor enforcement is generator-only. Don't suggest adding an executor-level floor assert unless the user asks.
- [non-blocker] `require('<pkg>')` for optional peers should live inside the function body, after version detection. Anti-pattern: §9.

## 7. Tests

- [blocker] `all-generators-enforce-floor.spec.ts` exists at `packages/<plugin>/src/utils/all-generators-enforce-floor.spec.ts`, calls `assertGeneratorsEnforceVersionFloor` from `@nx/devkit/internal-testing-utils`. This is the parameterized spec that exercises every generator's floor assert.
- [blocker] `subFloorVersion` is a semver range where `lt(coerce(it).version, floor)` is true. No pre-release identifiers. Reference values: `~18.2.0` (angular, v19 floor), `~12.17.0` (cypress, v13 floor), `~1.35.0` (playwright, v1.36 floor).
- [non-blocker] Plugins establishing the pattern (`#35587` angular) ship a `assert-supported-<pkg>-version.spec.ts` with the 5 canonical cases (sub-floor / fresh-install / `latest` / `next` / in-range). The underlying `assertSupportedPackageVersion` already has full coverage in `@nx/devkit`, so the per-plugin spec largely re-tests the shared helper. Useful for symmetry across the PR series but not required — don't block on missing.
- [non-blocker] Runtime/executor feature-gate throw tests are nice-to-have, not required — reference PRs (`#35587`, `#35642`, `#35670`) do not have them today.
- [non-blocker] Error message matching uses substring (`toThrow('Unsupported version of \`<pkg>\` detected')`) instead of hand-rolled `RegExp`. Anti-pattern: §13.
- [non-blocker] FS-side helper migrated to `getInstalledPackageVersion`; tree-side helper may stay inline. The two helpers' `null` vs. fallback semantics differ. Reference: `#35670` `packages/cypress/src/utils/versions.ts` rewrite.

## Open questions to raise (when missing from the PR / Linear task)

1. **Floor:** deliberate raise from the previous declared peer, or matching the existing peer? If raise: do sub-floor users get a `packageJsonUpdates` bridge or manual bump?
2. **Peer-range tightening:** dropping a major because there's no install lane (legitimate, `#35671` pattern) or because tests fail (regression risk — investigate)?
3. **`requires` removals on Nx-only migrations:** genuinely Nx-only, or sneaking through a third-party-touching change?
4. **Pruned migrations gaps:** if floor is being raised by N+ majors and prior `packageJsonUpdates` entries were removed, do sub-floor users have any auto-bump path? `git log --all -- packages/<plugin>/migrations.json`.
5. **Runtime feature gates:** threshold verified against third-party release notes, or guessed?
6. **Sibling classification:** ecosystem-locked vs. independent. Read the sibling's `peerDependencies` at the bumped-from range. `@angular-devkit/build-angular` is the gotcha — peer-locked from v20+, NOT v19.
7. **Cross-plugin coordination:** if the plugin pins a third-party that another plugin also manages (e.g., `@nx/cypress` pinning vite for cypress v13/v14+; `@nx/vite` supporting vite v5–v8), confirm the windows stay aligned. If `@nx/vite` drops v5, `@nx/cypress` carries an orphaned install lane.

## Verdict template

```
Blockers: <N>
Non-blockers: <N>

1. Peer dep & install constants: [pass | <findings>]
2. Generator entry points: [pass | <findings>]
3. Generator outputs: [pass | <findings>]
4. keepExistingVersions: [pass | <findings>]
5. Migration gates: [pass | <findings>]
6. Executor / runtime / inferred-plugin: [pass | <findings>]
7. Tests: [pass | <findings>]

Open questions for author: [list]

Scope drift vs. Linear task (if applicable):
- Findings in task NOT addressed: <list>
- Changes in PR NOT in task: <list>
```

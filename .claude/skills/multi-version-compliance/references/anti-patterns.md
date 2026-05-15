# Anti-patterns

Patterns to reject in your own work and flag in reviews. Each entry: what it looks like, why it's wrong, what to do instead, and a reference.

## 1. Local re-implementation of the shared helpers

**Looks like:** A new file in the plugin defining any of:

- `throwBelowFloor` / `throwAboveWindow` / `assertVersion` / `checkMinimumVersion` — duplicates `throwForUnsupportedVersion` / `assertSupportedPackageVersion`.
- `function cleanVersion(v) { return clean(v) ?? coerce(v)?.version ?? undefined; }` — duplicates `normalizeSemver`.
- `getInstalledRsbuildVersionRuntime` / `getInstalled<X>FromFs` reading `require('<pkg>/package.json')` directly — duplicates `getInstalledPackageVersion`.
- Inline `clean(declared) ?? coerce(declared)` chain at a generator entry point — duplicates `getDeclaredPackageVersion`.

**Why wrong:** The shared helpers in `@nx/devkit/internal` and `@nx/devkit/internal-testing-utils` already exist. Duplicates create drift — one will get the `latest`/`next` handling, the other won't; one will use `getNxRequirePaths()` for pnpm-strict resolution, the other won't.

**Do instead:** Call `assertSupportedPackageVersion(tree, pkg, floor)` via the per-plugin wrapper (`assertSupportedXVersion`). For executor-side reads: `getInstalledPackageVersion(pkg)`. For tree-side normalization: `getDeclaredPackageVersion(tree, pkg, latestKnown)`. For raw semver cleaning: `normalizeSemver(v)`.

**Reference:** Compliant — `packages/cypress/src/utils/assert-supported-cypress-version.ts` (7 lines). Concrete anti-pattern — PR `#35676` introduces `function cleanVersion` (`packages/rsbuild/src/utils/versions.ts`) and `getInstalledRsbuildVersionRuntime` reading `require('@rsbuild/core/package.json')`. Both should call the shared helpers instead.

## 2. Above-ceiling throw or warn

**Looks like:** `if (major > maxKnown) throw …`, `if (major > maxKnown) logger.warn …`, `versions()` with a `switch + throw default:`, any `warnAboveCeiling` / `throwAboveWindow` helper.

**Why wrong:** Explicit policy. Above-ceiling falls through silently to `latestVersions`. Throwing breaks users on newer versions of third-party packages, which is the opposite of the initiative's intent. The angular reference implementation does not warn or branch above the highest known major, and every subsequent plugin compliance PR follows that convention.

**Do instead:** `versionMap[major] ?? latestVersions`. Below-floor is caught by the generator-level assert; the `versions()` function is just a lookup.

**Reference:** Compliant — `packages/cypress/src/utils/versions.ts` after `#35670` rewrite. Anti-pattern (before fix) — same file before `#35670` had `switch + throw default:`.

## 3. Hardcoded third-party version in generator body

**Looks like:**

```ts
addDependenciesToPackageJson(tree, {}, { rspack: '^1.1.10' });
```

in a generator.

**Why wrong:** Bypasses the `versions(tree)` routing and the install-lane logic. New majors will not be picked up; older workspaces get the wrong version.

**Do instead:** Route through `versions(tree)` and reference the per-major entry. If you genuinely have a version that's the same across all majors, still put it in the map for consistency.

## 4. Init generator overwriting pinned versions

**Looks like:** `addDependenciesToPackageJson(tree, …, …, undefined, options.keepExistingVersions)` where the schema default is `false`. Or no fifth argument at all (defaults to `false`).

**Known-incomplete reference:** `@nx/angular`'s `init/schema.json` currently has `default: false` and `init.ts` passes `options.keepExistingVersions` directly — PR `#35587` did not fix this. The angular init generator therefore still has this bug. Flagging it in a non-angular compliance PR is correct; fixing it in passing during another angular PR is also appropriate.

**Why wrong:** Generators bump packages = the user's pinned version is silently overwritten on re-run. Bumping is the job of migrations, not generators.

**Do instead:** Pass `keepExistingVersions: true` (positional 5th arg) or `options.keepExistingVersions ?? true`. Flip the schema default to `true`.

**Reference:** Compliant — `packages/cypress/src/generators/init/init.ts` and `init/schema.json` after `#35670`. Anti-pattern — the same files before `#35670` had schema default `false`.

## 5. `requires` gate on an Nx-only migration

**Looks like:**

```json
{
  "update-unit-test-runner-option": {
    "requires": { "@angular/core": ">=21.0.0" },
    "description": "Update 'vitest' unit test runner option to 'vitest-analog' in generator defaults."
  }
}
```

when the migration only writes to `nx.json`.

**Why wrong:** The migration applies regardless of third-party version — it's rewriting an Nx-owned generator default. The gate causes pre-v21 workspaces with the stale default to silently skip the migration and stay broken.

**Do instead:** Remove the `requires` entry entirely. Nx-only migrations have no third-party gate.

**Reference:** Anti-pattern (before fix) — `packages/angular/migrations.json` `update-unit-test-runner-option`. Fix — `#35587` removed the gate.

## 6. Cross-major `packageJsonUpdates` with no `requires`

**Looks like:**

```json
{
  "21.3.0": {
    "packages": {
      "jest": { "version": "^30.0.0" }
    }
  }
}
```

with no `requires` gate, when this is a v29 → v30 bump.

**Why wrong:** The bump fires for every workspace — including workspaces already on v30 (idempotent best case) or workspaces on v28 or below (which would silently land on v30 without going through any v29 → v30 codemods). Source-major gate ensures the bump only fires for workspaces actually in the source range.

**Do instead:**

```json
{
  "21.3.0": {
    "requires": { "jest": ">=29.0.0 <30.0.0" },
    "packages": { "jest": { "version": "^30.0.0" } }
  }
}
```

**Reference:** Compliant — `packages/angular/migrations.json` MF entries after `#35587`. Anti-pattern examples on master at time of writing — `@nx/jest` `21.3.0`, `@nx/eslint` `20.7.0`, `@nx/vite` `20.5.0` (verify by inspecting each plugin's `migrations.json` for cross-major `packageJsonUpdates` entries lacking `requires`).

## 7. Gating ecosystem-locked siblings on the primary's major alone

**Looks like:** A migration that bumps `@ngrx/store` from v18 to v19 with `requires: { "@angular/core": ">=19.0.0" }` only — no `@ngrx/store` entry.

**Why wrong:** `@ngrx/store` is independent of `@angular/core` versioning. A workspace can be on `@angular/core: 19` without having `@ngrx/store: 18` (might not use ngrx at all, or might be on v17). Gating on `@angular/core` fires the migration in workspaces where it has nothing to do.

**Do instead:** Add the sibling to `requires`: `{ "@angular/core": ">=19.0.0", "@ngrx/store": ">=18.0.0 <19.0.0" }`. For Angular ecosystem siblings: `@angular/cli`, `@angular/ssr`, `@angular-devkit/build-angular` (v20+) are peer-locked via `@angular/core` and don't need their own gate. `@ngrx/*`, `@angular-eslint/*`, `zone.js`, `jest-preset-angular` are independent and do.

**How to verify pairing:** read the sibling package's `peerDependencies` at the version range being bumped from. If it pins the primary's major, the primary's `requires` covers it. If it doesn't, the sibling is independent and needs its own gate.

## 8. Peer dep claiming a major with no install branch (phantom claim)

**Looks like:**

```json
{
  "peerDependencies": {
    "vitest": "^1.0.0 || ^2.0.0 || ^3.0.0 || ^4.0.0"
  }
}
```

when `versions.ts` has no v1 entry and no `isVitestV1` branch anywhere.

**Why wrong:** The plugin advertises support for a version it doesn't honor. v1 workspaces silently fall through to v4 install constants.

**Do instead:** Drop the unsupported major from the peer. `vitest: "^2.0.0 || ^3.0.0 || ^4.0.0"`. If the support is desired, add the install lane.

**Reference:** Pattern demonstrated in open PR `#35671` (`@nx/vitest`) — drops `^1.0.0` from the `vitest` peer because there's no v1 install lane in the plugin's `versions.ts`. Inspect via `gh pr diff 35671 --repo nrwl/nx -- packages/vitest/package.json`. Verify state first.

**Related — drop EOL major (different reasoning, same action):** the major HAS an install lane but is EOL upstream (e.g., Storybook's official policy is "top 3 majors only"; v7 is EOL). Drop it from the peer because it's upstream-unsupported, not because the plugin doesn't honor it. Concrete example: NXC-4406 calls out dropping Storybook v7 from `@nx/storybook`'s peer per Storybook's top-3-majors policy.

## 8a. PeerDep range wider than the runtime dep pin

**Looks like:**

```json
{
  "peerDependencies": {
    "@typescript-eslint/parser": "^6.0.0 || ^7.0.0 || ^8.0.0"
  },
  "dependencies": {
    "@typescript-eslint/parser": "^8.0.0"
  }
}
```

The plugin's own runtime dep pins ^8, but the peer claims ^6/^7/^8.

**Why wrong:** Distinct from §8 — here the install lane exists (in `dependencies`), but the lane only ships one major. The peer is over-promising relative to what the plugin actually runs against. A workspace on ^6 will satisfy the peer but won't get a compatible runtime once `@typescript-eslint/parser@^8` resolves.

**Do instead:** Tighten the peer to the actually-supported runtime range, or widen the runtime dep + add the install/branch lanes for the additional majors.

**Reference:** NXC-4388 (`@nx/eslint-plugin`).

## 9. Top-level `require()` of an optional peer in an executor

**Looks like:**

```ts
// at the top of executor.impl.ts
const cypress = require('cypress');
```

**Why wrong:** When cypress is absent (not yet installed, peer mismatch, etc.), the executor throws `MODULE_NOT_FOUND` at module load time, before any user-friendly error. Especially bad for deprecated executors that should fail with a deprecation message.

**Do instead:** `require` inside the function body, after the version detection / clear error.

## 10. Anything-but-`requires` as substitute for `requires`

**Looks like (variant A — `incompatibleWith` standing in):**

```json
{
  "21.0.0-source-bump": {
    "incompatibleWith": { "@angular-devkit/build-angular": "<21.0.0" },
    "packages": { "...": { "version": "..." } }
  }
}
```

to "gate" a bump to v21+ source workspaces.

**Looks like (variant B — runtime per-package guard):**

```ts
// inside the migration function body
const installed = getInstalledVersion('@typescript-eslint/parser');
if (gte(installed, '8.0.0') && lt(installed, '8.13.0')) {
  // run the migration
}
return; // otherwise skip
```

with no `requires` block on the migration entry in `migrations.json`.

**Why wrong:** Neither approach is a source-major gate.

- `incompatibleWith` blocks running on workspaces that have the matching version — it doesn't gate to a source-major range. A workspace on `@angular-devkit/build-angular: 22.0.0` will still pass the `incompatibleWith` check.
- A runtime per-package guard runs the migration _body_ on every workspace and skips internally. The migration record still appears as "executed" to the migrate runner, and any side effects (logging, partial work) leak. The `nx migrate` runner uses `requires` as the source-major filter; bypassing it means the migration isn't filtered at the right layer.

**Do instead:** `requires: { "<pkg>": ">=N.0.0 <(N+1).0.0" }` — the actual source-major gate at the migration-entry level. Drop the in-body guard once the `requires` is in place.

**Reference:** Anti-pattern (variant B) — `@nx/eslint` `update-typescript-eslint-v8.13.0` (NXC-4387) has runtime `gte('8.0.0') + lt('8.13.0')` per-package guards but no `requires` block. `@nx/jest` similar with `incompatibleWith` (NXC-4391).

## 11. Naming a specific plugin in shared helper docstrings

**Looks like:** A JSDoc in `assert-generators-enforce-version-floor.ts` referencing `migrate-to-cypress-11` as the example use case for `excludeGenerators`.

**Why wrong:** The helper is shared across plugins. Naming one plugin in its docstring is leaky.

**Do instead:** Generic phrasing — "generators that must run below the floor by design (e.g., migrators that lift sub-floor workspaces onto a supported version)".

**Reference:** an early draft of `#35670`'s test helper had the plugin-specific JSDoc; the merged version uses generic phrasing.

## 12. Both schema `"default": true` AND `options.keepExistingVersions ?? true`

**Looks like:**

```json
{ "keepExistingVersions": { "default": true } }
```

combined with

```ts
addDependenciesToPackageJson(tree, …, …, undefined, options.keepExistingVersions ?? true);
```

**Why wrong:** Two sources of truth. Either the schema default does the job (and `options.keepExistingVersions` will always be `true`) or the `?? true` fallback handles it (and the schema default is redundant).

**Do instead:** Pick one. Schema default is sufficient when the call site uses `options.keepExistingVersions` directly. The `?? true` fallback is only needed if the schema can be bypassed (programmatic invocation without schema validation).

## 13. Manual `RegExp` matching in tests instead of substring `toThrow`

**Looks like:**

```ts
.rejects.toThrow(new RegExp(`Unsupported version of \\\`${packageName}\\\` detected`));
```

**Why wrong:** Escape bugs. The backtick and the `${}` are easy to get wrong. The shared helper uses substring matching for a reason.

**Do instead:**

```ts
.rejects.toThrow(`Unsupported version of \`${packageName}\` detected`);
```

**Reference:** see how `assertGeneratorsEnforceVersionFloor` itself does the match in `packages/nx/src/internal-testing-utils/assert-generators-enforce-version-floor.ts` (grep for `Unsupported version of`).

## 14. Validating only at install sites instead of generator entry

**Looks like:** A `if (installedVersion < floor) throw …` check guarding only the `addDependenciesToPackageJson` call inside a generator, while the rest of the generator runs unconditionally.

**Why wrong:** The generator may write configuration or templates incompatible with the sub-floor third-party version before reaching the install branch. The assert must be at the entry point so nothing else runs.

**Do instead:** `assertSupportedXVersion(tree)` as the first statement in the generator's working function (`*Internal` for plugins with the wrapper/internal split; the function itself for single-function generators). The install branch can then assume the floor is met.

## 15. Per-major version aliases alongside the bundle map

**Looks like:**

```ts
export const vitestV4Version = '~4.1.0';
export const vitestV3Version = '^3.0.0';
export const vitestV2Version = '^2.1.8';
export const vitestVersion = vitestV4Version;

export const vitestV4CoverageV8Version = '~4.1.0';
export const vitestV3CoverageV8Version = '^3.0.5';
// ...etc

const versionMap = {
  3: { vitestVersion: '^3.0.0', vitestCoverageV8Version: '^3.0.5' },
  4: { vitestVersion: '~4.1.0', vitestCoverageV8Version: '~4.1.0' },
};
```

**Why wrong:** The aliases (`vitestV3Version`, `vitestV3CoverageV8Version`, etc.) duplicate the `versionMap` entries. They drift over time — someone bumps the map but forgets the alias (or vice versa), and the plugin starts installing one version via generators and another via tests/runtime. Also: every dropped major (e.g., when raising the floor) becomes three or four delete lines instead of one map entry.

**Do instead:** Keep the bundle pattern — the per-major `versionMap` is the only place those values live. Stable (cross-version-identical) deps stay as top-level `export const`s; varying deps are accessed via `versions(tree).<key>` or directly from the top-level `latestVersions` bundle.

**Reference:** Open PR `#35671` initially carried `vitestV2Version` / `vitestV3Version` / `vitestV4Version` aliases. A follow-up commit (`chore(testing): adopt cypress version-resolution pattern in @nx/vitest`) dropped them in favor of the bundle pattern. Inspect via `gh pr view 35671 --repo nrwl/nx --json commits`.

## 16. Declared floor below the effective floor

**Looks like:** `peerDependencies` lists `"vitest": "^2.0.0 || ^3.0.0 || ^4.0.0"` and `versions.ts` has a `versionMap` entry for `2`, but somewhere in the plugin's executor / runtime / plugin code there's an import of a third-party API that only exists in v3+:

```ts
// In a runtime helper used by the executor:
import { getRelevantTestSpecifications } from 'vitest/node';
// ^ This API only exists in vitest >= 3.0.0.
```

**Why wrong:** A workspace on v2 will pass the floor assert (peer + versionMap claim support), then crash at runtime with `getRelevantTestSpecifications is not a function`. The peer is lying.

**Do instead:** Raise the floor to the lowest major where every called third-party API exists. Drop the now-unsupported entries from `versionMap`, `peerDependencies`, and the per-major version aliases (if any). The `assert-supported-<pkg>-version.spec.ts` sub-floor test now covers the dropped major.

**Reference:** Open PR `#35671`'s second commit (`fix(testing): drop vitest v2 support from @nx/vitest`) — originally proposed a v2 floor matching the lowest install lane, then raised to v3 after audit caught the `getRelevantTestSpecifications` usage. Inspect via `gh pr view 35671 --repo nrwl/nx --json commits`.

## 17. Creating a branch during Phase 1–2 (discovery / read-only)

**Looks like:** `git checkout -b <some-branch>` before the user has approved Phase 3 edits.

**Why wrong:** Phase 1–2 produces findings, not commits. Creating a branch creates pressure to commit something. Any working artifact (e.g., `tmp/<plugin>-findings.md` for the no-task case) goes in `tmp/` (gitignored) — for the user to read and scope from, not to commit.

**Do instead:** Run Phase 1–2 on the current branch (typically `master`). Output to `tmp/<plugin>-findings.md` if you wrote one. Branch creation belongs in Phase 3, after explicit user approval to proceed with edits.

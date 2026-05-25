# Examples & references

Concrete files, commits, and PRs to grep when you need a model.

## Reference PRs (in order of arrival)

| PR       | Plugin           | Branch     | State                   | Why notable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------- | ---------------- | ---------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#35587` | `@nx/angular`    | `nxc-4381` | merged                  | First compliance PR. Established `throwForUnsupportedVersion`, the `assertSupported*Version` wrapper pattern, the `all-generators-enforce-floor.spec.ts` shape, the MF `requires`-gate pattern, the Nx-only-migration over-gate removal pattern.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `#35642` | `@nx/playwright` | `nxc-4398` | merged                  | Generalized the helpers into `version-floor.ts`/`installed-version.ts`. Added `assertGeneratorsEnforceVersionFloor` in `internal-testing-utils`. Established executor/runtime feature-gating pattern (blob reporter / `merge-reports`). Demonstrated the "fresh-install constant higher than peer floor" pattern.                                                                                                                                                                                                                                                                                                                                                                         |
| `#35670` | `@nx/cypress`    | `nxc-4384` | merged                  | Established `excludeGenerators` in the shared test helper for intentional sub-floor migrators (`migrate-to-cypress-11`). Demonstrated `versions()` switch-to-fallthrough rewrite. Demonstrated keeping the tree-side inline helper while migrating only the FS side to the shared helper.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `#35671` | `@nx/vitest`     | `nxc-4408` | open at time of writing | Three commits. (1) Establishes "drop phantom peer-range claim" (removes `^1.0.0` from peer); migration `requires` tightening for Vitest-4-only AI-instructions migrations. (2) Raises floor v2 → v3 after audit catches `getRelevantTestSpecifications` import (v3+ API) — establishes the **effective-floor-vs-declared-floor** pattern (see `anti-patterns.md` §16). (3) Adopts the cypress version-resolution pattern (bundle-of-varying-deps `versions(tree)`, `getInstalled<Pkg>Version(tree?)`, no per-major aliases — see `anti-patterns.md` §15). To inspect: `gh pr view 35671 --repo nrwl/nx --json commits` then `gh pr diff 35671`. Verify state — may have merged or closed. |

Always verify state with `gh pr view <N> --repo nrwl/nx --json state` before citing — this table goes stale.

## Reference commits (for `git show` inspection)

When the same change exists as both a pre-squash branch commit AND a merged squash on master, prefer the merged squash — it's the authoritative final state. Pre-squash SHAs are listed because they're easier to read in isolation (smaller diffs) when investigating one specific aspect.

**Merged on master (authoritative):**

| SHA          | Subject                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| `75578724fa` | `cleanup(core): add throwForUnsupportedVersion util to @nx/devkit/internal`  |
| `484ce6e5d5` | `fix(angular): multi-version support compliance (#35587)`                    |
| `78f908d015` | `cleanup(angular): adopt shared version-floor helpers`                       |
| `e2ef134645` | `fix(testing): multi-version support compliance for @nx/playwright (#35642)` |
| `5d8b1bab7e` | `cleanup(devkit): allow excluding generators from version floor test helper` |
| `bc35b484e3` | `fix(testing): multi-version support compliance for @nx/cypress (#35670)`    |

Pre-squash branch SHAs are available via `gh pr view <N> --json commits` even after the branch is deleted; useful when inspecting one specific aspect of a merged PR in isolation. Example:

```bash
gh pr view 35642 --repo nrwl/nx --json commits | jq -r '.commits[] | "\(.oid[:10]) \(.messageHeadline)"'
```

## Shared helpers — current locations

| File                                                                                | Exports                                                                                                                    |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `packages/devkit/src/utils/version-floor.ts`                                        | `throwForUnsupportedVersion` (internal-only), `assertSupportedPackageVersion`                                              |
| `packages/devkit/src/utils/installed-version.ts`                                    | `getInstalledPackageVersion`, `getDeclaredPackageVersion`, `isNonSemverDistTag`, `normalizeSemver`, `NON_SEMVER_DIST_TAGS` |
| `packages/devkit/internal.ts`                                                       | re-exports from above (this is `@nx/devkit/internal`)                                                                      |
| `packages/nx/src/internal-testing-utils/assert-generators-enforce-version-floor.ts` | `assertGeneratorsEnforceVersionFloor`                                                                                      |
| `packages/devkit/internal-testing-utils.ts`                                         | re-exports `assertGeneratorsEnforceVersionFloor` (this is `@nx/devkit/internal-testing-utils`)                             |

## Per-plugin compliant files (grep for the pattern)

### `@nx/angular` (most extensive — has the `supportedVersions` list pattern)

- `packages/angular/src/utils/assert-supported-angular-version.ts` — wrapper using `Math.min(...supportedVersions)`
- `packages/angular/src/utils/assert-supported-angular-version.spec.ts` — the canonical 5-case spec
- `packages/angular/src/utils/all-generators-enforce-floor.spec.ts` — the parameterized floor spec
- `packages/angular/src/generators/add-linting/lib/add-angular-eslint-dependencies.ts` — `keepExistingVersions: true` pattern
- `packages/angular/migrations.json` — MF `requires` gates and the over-gate removal

### `@nx/playwright` (the helpers were generalized here)

- `packages/playwright/src/utils/assert-supported-playwright-version.ts` — wrapper using a `minSupportedPlaywrightVersion` constant
- `packages/playwright/src/utils/all-generators-enforce-floor.spec.ts`
- `packages/playwright/src/utils/preset.ts` — runtime feature gating (blob reporter)
- `packages/playwright/src/executors/merge-reports/merge-reports.impl.ts` — executor feature gating
- `packages/playwright/src/utils/versions.ts` — `minSupportedPlaywrightVersion`, `minPlaywrightVersionForBlobReports`, `playwrightVersion = '^1.37.0'` (fresh install higher than peer)
- `packages/playwright/src/utils/add-linter.ts` — `keepExistingVersions: true` in linter helper
- `packages/playwright/package.json` — peer `^1.36.0` (unchanged), added `"semver": "catalog:"`

### `@nx/cypress` (excludeGenerators + versions() rewrite)

- `packages/cypress/src/utils/assert-supported-cypress-version.ts`
- `packages/cypress/src/utils/all-generators-enforce-floor.spec.ts` — uses `excludeGenerators: ['migrate-to-cypress-11']` with code comment
- `packages/cypress/src/utils/versions.ts` — `versions()` rewritten to `versionMap[major] ?? latestVersions`; `getInstalledCypressVersion` FS-path migrated to shared helper, tree-path kept inline

## Finding current work-in-progress

To enumerate all compliance PRs (merged + open) without relying on out-of-tree tracking docs:

```bash
# Open + merged compliance PRs
gh pr list --repo nrwl/nx --search "multi-version compliance" --state all --limit 30 \
  --json number,title,state,headRefName,author

# Just open ones
gh pr list --repo nrwl/nx --search "multi-version compliance" --state open
```

This is the authoritative list. Plugins covered to date can be derived by inspecting which packages each merged PR touched.

To check which plugins still have known anti-patterns (e.g., phantom peer claims, missing floor assert), grep on master:

```bash
# Plugins WITHOUT an assert-supported-<pkg>-version wrapper
for d in packages/*/src/utils; do
  pkg=$(dirname "$d" | xargs basename)
  if [ ! -f "$d/assert-supported-$pkg-version.ts" ] && \
     [ ! -f "$d/assert-supported-${pkg/_/-}-version.ts" ]; then
    echo "$pkg: no assert-supported wrapper"
  fi
done

# Plugins missing the parameterized floor spec
find packages -name "all-generators-enforce-floor.spec.ts" -not -path "*/dist/*"
```

Cross-reference with the third-party packages each plugin manages (peer deps in `package.json`).

## How to use these examples

When auditing a new plugin, before writing anything:

1. Read the PR body of `#35642` (`@nx/playwright`) — it's the most comprehensive description of the canonical shape.
2. Read the four files from `@nx/playwright`: `versions.ts`, `assert-supported-playwright-version.ts`, `all-generators-enforce-floor.spec.ts`, and `preset.ts`. Five minutes.
3. If your plugin has a `migrations.json` of any complexity, also read `packages/angular/migrations.json` MF entries and the `update-unit-test-runner-option` entry for the gate patterns.
4. If the plugin has runtime feature gates, also read `packages/playwright/src/executors/merge-reports/merge-reports.impl.ts`.

When reviewing a compliance PR, the diff should look very similar to one of these reference PRs. Differences should be justifiable by the plugin's specifics (different floor, different feature gates, different migration shape) — not by departing from the canonical patterns.

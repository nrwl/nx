---
name: author-migration
description: >-
  Author or scope a first-party Nx migration. Use whenever code removes, renames,
  or deprecates an option/flag/executor/generator-schema field, changes a default,
  or bumps a dependency, and someone asks whether existing workspaces need a
  migration so they don't break on `nx migrate`/upgrade. Covers writing the
  colocated update-VER/NAME.{ts,spec.ts,md} set, the migrations.json entry
  (version, requires, implementation, prompt, documentation) or packageJsonUpdates
  block, and the AI-agent prompt/runbook .md for judgment-only or hybrid
  (codemod + prompt) migrations. Also covers porting an upstream framework's own
  migrations into Nx. Invoke BEFORE writing or editing any migration, migration
  prompt/runbook, or packageJsonUpdates entry, and before concluding a breaking
  change needs no migration at all.
---

# Author a first-party Nx migration

Follow this whenever a migration (or a decision that one is not needed) is part of the work. Companion files in this directory:

- [runtime-contract.md](runtime-contract.md): how `nx migrate` consumes every migrations.json key. Read it before wiring an entry; most authoring mistakes are wrong assumptions about this contract.
- [deprecated-patterns.md](deprecated-patterns.md): patterns to never reproduce, with recognition signatures. Read it before copying from an existing migration or from git history.
- [templates/](templates/): entry shapes, spec skeleton, and the two .md genres.

## 1. Decompose the change into migration needs

Enumerate every breaking or behavior-changing item in the change (upstream changelog, upstream migration guide, upstream repo's own migrations directory, or the Nx-internal change itself). Classify each item with exactly one treatment:

| Treatment                 | When                                                                                                    | Shape                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nothing                   | Additive upstream change, no user action needed                                                         | No entry                                                                                                                                                                                                     |
| Version admission         | A new upstream major just needs to be allowed                                                           | `packageJsonUpdates` group gated on the source-major window (see `packages/storybook/migrations.json` key `23.1.0`)                                                                                          |
| Plain bump                | Dependency versions change, nothing else                                                                | Declarative `packageJsonUpdates`. Never write a .ts implementation for an unconditional bump                                                                                                                 |
| Conditional dep change    | Add/remove/swap a dependency based on workspace state                                                   | .ts implementation using `addDependenciesToPackageJson` / `removeDependenciesFromPackageJson` (add side: see `packages/angular/src/migrations/update-23-1-0/add-angular-build.ts`)                           |
| Codemod                   | Deterministic, statically detectable source or config change (removed option, key rename, default flip) | `implementation` + spec + `documentation` .md                                                                                                                                                                |
| Ported upstream migration | Upstream ships its own migrations for the major                                                         | One codemod per upstream migration, description ending "matching the <upstream> `X` migration", `requires` on the new major (see `packages/angular/migrations.json` `update-23-1-0-add-trust-proxy-headers`) |
| Run upstream codemod      | Upstream publishes an npx-runnable codemod                                                              | Prompt migration instructing the agent to run it; do not port it (see `packages/react/src/migrations/update-23-1-0/ai-instructions-for-react-19.md`)                                                         |
| Prompt-only               | Change requires judgment an AST transform cannot make                                                   | `prompt` .md, no implementation                                                                                                                                                                              |
| Hybrid                    | Mechanical pre-pass plus judgment                                                                       | ONE entry with both `implementation` and `prompt` (see eslint `update-23-1-0-convert-to-flat-config`; do not copy its shared .md basename)                                                                   |

Never author: executor-to-inferred conversions (that is the user-invoked `convert-to-inferred` generator, not a migration), or migrations for unreleased/speculative upstream behavior.

Record the mapping in the PR description under a `## Migration coverage` heading: one line per upstream item, its treatment, and a one-clause justification for anything classified Nothing or prompt-only.

## 2. Version and gating

### Entry version

The version field is a gate, not a label: an entry runs when `installed < version <= target` with semver prerelease ordering (see [runtime-contract.md](runtime-contract.md)).

- Set it to the exact next prerelease of the active train: latest tag + 1 (`git tag --sort=-creatordate | head -5`, or `npm view nx dist-tags`). Example: latest tag `23.1.0-beta.8` -> write `23.1.0-beta.9`.
- Never a bare final version (prerelease users would skip it) and never a backdated prerelease (users past that prerelease silently skip it). Always latest tag + 1, even when batching related migrations.
- If the latest tag is a stable that is newer than the `next` dist-tag, the train rolled over: use `<next-minor-or-major>-beta.0`.
- The version field does not choose which release ships the code; the branch does. A breaking migration must wait for the train switch before merging (the SVGR removal was fully reverted for landing on the wrong train).
- Fixing a shipped migration: amend the implementation in place AND bump the entry version to the current next prerelease so workspaces that already ran the broken version re-run it.

### requires

- `requires` evaluates against the version the package will LAND on in this run (pending packageJsonUpdates first, installed as fallback), with `includePrerelease`. A package absent from both fails the gate.
- Codemod for upstream major N: gate `{"<pkg>": ">=N.0.0"}`. It fires when the same run bumps into N.
- Never put an upper bound on a migration entry's `requires` from-version: if the same run bumps the package past the bound, the migration is dead (this shipped as a real bug in storybook, fixed by dropping the bound). Upper-bounded source windows belong on `packageJsonUpdates.requires`.
- `requires` is AND across packages. Mutually exclusive conditions need separate entries; a condition `requires` cannot express (an OR of packages) gets a code-level gate via `getDeclaredPackageVersion` + semver inside the migration function.
- `packageJsonUpdates` groups gate on the SOURCE major window (`">=N.0.0 <N+1.0.0"`), one group per supported source major, ordered oldest source major first: groups are processed in key order in a single pass and each accepted group feeds the next group's `requires`, which is what lets a workspace chain major steps. Unlike migration entries, a group's `version` gate is inclusive on the installed side (`installed <= version <= target`).
- Nx-version-only migrations carry no `requires`.

## 3. Scaffold

Layout, always:

```
packages/<plugin>/src/migrations/update-<major>-<minor>-<patch>/<name>.ts
packages/<plugin>/src/migrations/update-<major>-<minor>-<patch>/<name>.spec.ts
packages/<plugin>/src/migrations/update-<major>-<minor>-<patch>/<name>.md         (documentation: same basename as the .ts)
packages/<plugin>/src/migrations/update-<major>-<minor>-<patch>/<other-name>.md   (prompt: basename must differ from any .ts)
```

Entry key: `update-<major>-<minor>-<patch>-<kebab-slug>`, where the version part mirrors the entry's version field (drift makes docs group the entry under the wrong release) and the slug names the action. The key is user-visible: it becomes the `--create-commits` commit subject, the docs anchor, and the run listing line.

Do not rely on `@nx/plugin:migration` generator output alone: it scaffolds empty stubs, defaults the key to the bare filename, and never writes `requires`, `.md` files, prompt entries, or per-package `packageJsonUpdates` details. Hand-author from [templates/migrations-json.md](templates/migrations-json.md).

First migration in a plugin? Also check:

- `package.json` has `"nx-migrations": { "migrations": "./migrations.json", "supportsOptionalMigrations": true }` (new plugins use `nx-migrations`; `ng-update` is legacy Angular CLI interop, do not add it).
- `migrations.json` starts with `"$schema": "../../node_modules/nx/schemas/migrations-schema.json"` (new files only; do not backfill others).
- `assets.json` copies `src/migrations/**/*.md` into dist. A missing glob silently drops the .md from the published package, which breaks `prompt`/`documentation` resolution and the docs site.
- A root `migrations.spec.ts` calling `assertValidMigrationPaths` from `@nx/devkit/internal-testing-utils` exists.
- The plugin's eslint config applies `@nx/nx-plugin-checks` with `./migrations.json` in the rule's `files` array.
- A brand-new `@nx/*` plugin must be added to `packages/nx/package.json` `nx-migrations.packageGroup`, or `nx migrate` will never bump it. Nothing lints this; check manually.

## 4. Implement

### Common canon (every migration)

- `export default async function update(tree: Tree)` and nothing else. Migrations take no options; the runner calls them with `(tree, {})`.
- Import helpers from `@nx/devkit` and, for the semi-private ones (`forEachExecutorOptions`, target-default helpers), from `@nx/devkit/internal`. Exception: migrations inside `packages/nx` itself use relative imports and `formatChangedFilesWithPrettierIfAvailable`.
- Tree APIs only, never `fs`. All existence/content checks via `tree.exists` / `tree.read` / `readJson`.
- End with `await formatFiles(tree)` (skip only when the migration touches no JS/TS/JSON surface).
- User-facing warnings via devkit `logger.warn`, listing the affected files, reserved for cases the user must finish manually. Never `console.*`.
- Version strings come from named constants (`nxVersion` and friends from the plugin's `utils/versions`), or a local const frozen in the migration file when the value must not float with later releases. Never inline version literals at call sites.
- Fail open: skip files or projects the migration cannot parse or does not recognize (early return), never throw. A throwing migration aborts the user's whole `nx migrate --run-migrations` run with no resume.
- Idempotent by construction: the rewrite consumes its own trigger, or the write is gated on `updated !== original`, or there is an explicit already-migrated guard. `nx repair` re-runs nx-core migrations unconditionally (minus `x-repair-skip`), and users re-run failed sessions.
- Never return a `GeneratorCallback` or install task; the return value contract is `void | string[] | { nextSteps, agentContext }` and callbacks are silently discarded. The runner handles installs by diffing package.json.

### Codemods

Exemplars: `packages/vite/src/migrations/update-23-0-0/migrate-to-vitest-4.ts`, `packages/angular/src/migrations/update-21-2-0/replace-provide-server-routing.ts`.

- Discovery: scope to relevant projects first (project-graph dependency filtering, or `forEachExecutorOptions` when the file set derives from executor options), then `visitNotIgnoredFiles` over each project root. Prefilter before parsing: check the extension, then bail unless the content `.includes()` the trigger token.
- Parse with tsquery (`ast` + `query`) for selector-style lookups or the raw TypeScript API for structural checks. Use the AST only to LOCATE positions, then splice replacement text into the original content: devkit `applyChangesToString` (sorts and offsets the edits internally; see `packages/angular/src/migrations/update-23-0-0/rewrite-internal-subpath-imports.ts`) or a local splice helper like the exemplars above use. Never reprint a whole file through `ts.createPrinter`; it destroys the user's formatting.
- Load TypeScript lazily: `import type * as ts from 'typescript'` at the top plus `ensureTypescript()` (from `@nx/js/internal`) or `ensurePackage<typeof import('typescript')>('typescript', '*')` at first use. No static value import.
- For `.js` config files parse with `ts.createSourceFile(..., ScriptKind.JS)`.

### Config edits

- Project targets: `getProjects(tree)`, mutate, `updateProjectConfiguration` guarded by a changed flag. Never raw `updateJson` on `project.json`: it silently skips package.json-based projects.
- `getProjects` does not merge `targetDefaults` or inferred targets. A migration about an executor's options must also scan `nx.json` `targetDefaults` and, where relevant, the inferred-plugin registration.
- nx.json: `readNxJson(tree)` / `updateNxJson(tree, nxJson)`, write only when changed. `targetDefaults` keys may be target names or executors and values may be objects or arrays; guard with `Array.isArray`. Generator defaults come in two shapes (flat `"@nx/x:gen"` keys and nested `"@nx/x": { gen: {} }`); handle both.
- Plugin registrations are `string | ExpandedPluginConfiguration`; match with `typeof p === 'string' ? p === name : p.plugin === name`, preserve array order and per-entry include/exclude scopes, and gate registration on actual usage (glob the tool's config files first).
- Dual-world rule: a migration touching a tool's configuration handles executor-based targets, inferred-plugin registrations, and `targetDefaults` independently in one pass (exemplar: `packages/vite/src/migrations/update-23-0-0/ensure-vitest-package-migration.ts`).
- Ignore files: `addEntryToGitIgnore` (`packages/nx/src/utils/ignore.ts`, parses with the `ignore` package instead of substring matching); keep the `if (tree.exists('lerna.json') && !tree.exists('nx.json')) return` guard used by this family.
- Invoking a generator from a migration is sanctioned only for same-package generators via relative import, passing `keepExistingVersions: true` and `skipFormat: true` where supported so `packageJsonUpdates` keeps ownership of version bumps.

### Dependency updates

Declarative `packageJsonUpdates` first; a .ts implementation only for conditional logic. In groups: explicit `"alwaysAddToPackageJson": false` on bump-only packages; `requires` for gating; do not use `x-prompt` (deprecated) or `ifPackageInstalled` (unused; gate with `requires`). To bump a package that ships its own migrations without triggering them (the `@angular/cli` pattern), set `ignorePackageGroup: true` and `ignoreMigrations: true` on that package's update.

### Prompt-only and hybrid

- The prompt .md is colocated in the `update-<ver>/` directory. Its filename MUST differ from any implementation basename: the docs site inlines `<implementation path>.md` into public docs, so a shared basename leaks the LLM runbook onto nx.dev. Pattern to copy: jest's `set-ts-jest-isolated-modules` pairs `documentation: set-ts-jest-isolated-modules.md` with `prompt: verify-typecheck.md`.
- Naming: `ai-instructions-for-<framework>-<major>.md` for whole-framework upgrade runbooks; task-named files (`migrate-ban-types-rule.md`) for scoped tasks.
- Write the runbook per [templates/prompt-runbook.md](templates/prompt-runbook.md). Every scoped-task prompt opens with a no-op guard: confirm the preconditions, otherwise change nothing and stop (exemplar: `packages/eslint/src/migrations/update-23-1-0/migrate-ban-types-rule.md`).
- Prompt-only migrations execute only under the agentic flow; in plain runs they surface as next steps. Do not put must-happen changes in a prompt.
- Hybrid = one entry with both `implementation` and `prompt`. The .ts does only mechanically safe edits, accumulates human-readable descriptions of every shape it could not handle, and returns `{ nextSteps, agentContext }`. `agentContext` is silently dropped in non-agentic runs, so ALWAYS return `nextSteps` covering the same ground for human users. The .md tells the agent to verify (not redo) the pre-pass output and treat each advisory-context item as pending work. Exemplar: eslint `convert-to-flat-config` (copy its return contract, not its shared implementation/prompt basename, which predates the naming rule above).
- Re-delivering an existing prompt at a later version: add a new entry pointing at the same .md; the runner dedupes by path.

## 5. Test and validate

Spec canon (skeleton in [templates/spec-skeleton.md](templates/spec-skeleton.md)):

- `createTreeWithEmptyWorkspace()` + `tree.write` / `addProjectConfiguration` to arrange; run the imported default export; assert with explicit reads (`readJson`, `tree.read(..., 'utf-8')`) using `toBe`/`toEqual`/`toContain` or `toMatchInlineSnapshot`. Never `toMatchSnapshot` (external snapshot files); no migration spec uses it.
- Mandatory negative test: capture the content, run the migration on a workspace it should not touch, assert the content is unchanged.
- Mandatory idempotency test when the trigger can survive: run the migration twice, assert the second run changes nothing.
- Mandatory malformed-input test when the migration parses files: feed an unparseable file and assert the migration skips it without throwing.
- Hybrids: `const result = await migration(tree)` and assert on `result.agentContext` / `result.nextSteps`.
- `packages/nx` specs import the tree util relatively; every other plugin from `@nx/devkit/testing`.

Static validation is weaker than it looks: `assertValidMigrationPaths` checks path resolution per entry but its orphan check is folder-granular, and `@nx/nx-plugin-checks` never ties an entry's name/version/description to its implementation path (a wrong-but-existing path passes everything; this shipped as a real bug in `packages/nx`). The pre-PR checklist below is the actual coherence gate.

Before release, validate against a real repository:

- Local registry: `pnpm local-registry` in one shell, `pnpm nx-release <next-prerelease> --local` to build and publish, then in the target repo run `NX_SKIP_PROVENANCE_CHECK=true nx migrate <version>` (locally published packages have no provenance attestations; without the variable migrate fails).
- Registry-free alternative: build and install the plugin tarball in the target repo, write a migrations file `{ "migrations": [{ "package", "name", "version" }] }`, and run `nx migrate --run-migrations=<file>`. No version-window or provenance checks on this path.

## 6. Docs and description

- `description` feeds the agentic prompt and the public docs page. State the concrete action ("Removes the deprecated X option from Y executor options"). For prompt migrations, also state why it is AI-driven ("...whose options do not map 1:1, so it is driven by an AI prompt rather than a deterministic codemod").
- Codemods get a colocated `documentation` .md per [templates/documentation-md.md](templates/documentation-md.md): h4/h5 headings only, short description, before/after samples. The `documentation` key is read only by the agentic flow; the docs site instead inlines the .md that shares the implementation's basename. Colocating one file named after the implementation serves both.
- Do not author: `cli` (dead key), `schema` (never read), `<version>--PackageGroup` keys (runtime-reserved).

## 7. Pre-PR checklist

- [ ] Entry key `update-<ver>-<slug>` and its version part matches the `version` field exactly.
- [ ] `implementation` path is dist-prefixed (`./dist/src/migrations/...`) and points at THIS migration's file (open the file and confirm; validation only checks that the path resolves, never that it matches the entry).
- [ ] `implementation` used, not `factory`; no `cli`, no `schema`.
- [ ] Version is latest tag + 1 on the active train; `requires` reviewed against landing versions (no upper bound on the entry's own gate).
- [ ] No orphans: every file under the touched `update-<ver>/` directory is referenced by an entry, and every new entry's files exist.
- [ ] Spec includes a negative test (plus a malformed-input test when the migration parses files); hybrid specs assert the return object; `formatFiles` called.
- [ ] .md files colocated and, for prompts, the filename differs from the implementation basename; `assets.json` covers `src/migrations/**/*.md`.
- [ ] PR description carries the `## Migration coverage` mapping.
- [ ] Real-repo validation done or explicitly handed off.

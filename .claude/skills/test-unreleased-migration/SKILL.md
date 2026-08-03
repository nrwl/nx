---
name: test-unreleased-migration
description: Test UNRELEASED nx migrations - ones that live only in a local working tree, branch, or PR (a local publish at most, never an upstream release) - against the real downstream repo set (ocean, nx-labs, nx-examples, nx-console). Sources the migrations locally, runs them, validates each repo (project graph resolves + lint/typecheck/build, optionally CI), reviews the diff, and reports pass/fail per repo. Does NOT open real migration PRs. Use when asked to "test a migration against the real repos", "try this migration on ocean/nx-console", "validate my unreleased migration", or before merging/releasing a migration authored with `author-migration`.
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, AskUserQuestion, Skill(polygraph:polygraph), Skill(run-nx-migration), Skill(polygraph:pack-and-copy), Skill(polygraph:await-polygraph-ci), mcp__plugin_polygraph_polygraph-mcp__show_session, mcp__plugin_polygraph_polygraph-mcp__add_repo, mcp__plugin_polygraph_polygraph-mcp__spawn_agent, mcp__plugin_polygraph_polygraph-mcp__show_agent, mcp__plugin_polygraph_polygraph-mcp__push_branch, mcp__plugin_polygraph_polygraph-mcp__create_pr
---

# Test an unreleased nx migration against the real repos

Run migrations that exist only in a local nx build - a working tree, a branch, a PR - against
the real downstream repos and report what breaks, before the migration is merged or released.
This closes the gap where an author cannot exercise a migration until it ships, which pushes the
testing burden onto ocean and nx-console after the fact.

This skill runs, validates, reviews, and reports. It does NOT fix and does NOT open real migration
PRs. The author fixes with `author-migration` and re-invokes this skill.

Companion pieces this skill composes (do not reimplement any of them):

- `run-nx-migration` - the per-repo run mechanics (package-manager handling, the `--create-commits`
  crash, applying deferred AI migrations, the graph-resolves verify) and the run gotchas. Its child
  block is injected into each per-repo child.
- `polygraph` - session lifecycle, `add_repo`, `spawn_agent`, `push_branch`, `create_pr`.
- `pack-and-copy` - build + pack the local nx and install the tarballs into each consumer as `file:`
  deps (the modes 2/3 delivery substrate).
- `await-polygraph-ci` - CI monitoring for the optional validation-PR tier.

## Roles

- **Publisher** = the repo holding the unreleased nx (normally the nrwl/nx checkout you are in).
- **Targets** = the downstream repos to test against. Default set: `ocean`, `nx-labs`, `nx-examples`,
  `nx-console` (all `nrwl`). nrwl/nx itself is the publisher, not a target.

## Input

- The unreleased nx source - the local nrwl/nx checkout on the branch/PR under test.
- Target version / window - the version the migrations target (their `migrations.json` entry
  versions), and the "from" version each target repo currently sits at.
- Mode - 1, 2, or 3 (below). If unspecified, default to mode 2 (fast, no publish).
- Target repos - all of the default set or a subset (see Run scope).
- `--focus` - optional review/report narrowing (see Review scope).

## Execution modes

Pick how much of the real `nx migrate` pipeline to exercise. More coverage costs more time.

| Mode                    | Exercises                                                                                 | Delivery                                                                                  | When                                          |
| ----------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| **1. Full**             | package updates + migration collection + registry resolution + temp-CLI install + run all | verdaccio local publish, then `nx migrate <VERSION>`                                      | most comprehensive; slowest                   |
| **2. All migrations**   | run the whole `migrations.json`, no collection / package update / temp-CLI                | pack-and-copy tarballs + a produced `migrations.json`, then `nx migrate --run-migrations` | fast validation of every migration            |
| **3. Single migration** | run one migration out of the list, nothing else                                           | same tarballs + `migrations.json`, then `nx migrate --run-migration=<package>:<name>`     | fastest loop while iterating on one migration |

## Procedure

### 1. Session + run scope (target repos)

Use the `polygraph` skill to start or join the session, then `add_repo` the publisher (nrwl/nx) and
the target repos so their work and any PRs link under one session.

**Run scope - which targets.** If the invocation names target repos, use them. If it does not, prompt
with `AskUserQuestion` (all of the default set vs a chosen subset) before starting - do not assume all.
The issue explicitly allows scoping a run to a single repo.

### 2. Build the unreleased nx (publisher)

Build the nrwl/nx packages so the changed `@nx/*` packages are packable / publishable. This is
repo-specific; use the repo's release/build tooling. Verify `dist/` output exists before delivery.

### 3. Deliver the local nx into each target - by mode

- **Mode 1 (verdaccio).** Publish the local build to the local registry with the repo's local-release
  flow (`pnpm nx-release <VERSION> -l`). Clear the package-manager caches first (stale entries resolve
  old versions):

  ```bash
  pnpm store prune --force && rm -rf ~/Library/Caches/pnpm && npm cache clean --force && rm -rf ~/.npm/_npx && bun pm cache rm
  ```

  Each target then runs the full `run-nx-migration` child block with `<REGISTRY>` pointed at the local
  verdaccio, so `nx migrate <VERSION>` collects the unreleased migrations from it.

- **Mode 2 (pack-and-copy + produced migrations.json).** Invoke the `pack-and-copy` skill to build +
  pack the changed `@nx/*` packages and install the tarballs into each target as `file:` deps. Then
  produce the executable `migrations.json` for each target:

  ```bash
  node .claude/skills/test-unreleased-migration/scripts/produce-migrations-json.mjs \
    --packages-dir <publisher-nx>/packages \
    --from <current-version> --to <VERSION> \
    --out <target-repo>/migrations.json
  ```

  Each target then runs the **Run-only** path of `run-nx-migration` (skip Generate; steps 7-11) with
  `NX_MIGRATE_USE_LOCAL=true NX_MIGRATE_SKIP_INSTALL=true nx migrate --run-migrations`, so the migrations
  execute against the tarball-installed local nx.

- **Mode 3 (same substrate, one migration).** Identical delivery to mode 2, because
  `--run-migration` reads `migrations.json` too: it selects one entry rather than replacing the file.
  Narrow the producer to the migration's own package so the file stays small:

  ```bash
  node .claude/skills/test-unreleased-migration/scripts/produce-migrations-json.mjs \
    --packages-dir <publisher-nx>/packages \
    --from <current-version> --to <VERSION> \
    --packages <package> \
    --out <target-repo>/migrations.json
  ```

  Then run `NX_MIGRATE_USE_LOCAL=true NX_MIGRATE_SKIP_INSTALL=true nx migrate --run-migration=<package>:<name>`.
  Both env vars matter: without the first, nx spawns a temp `nx@latest` that has none of the local
  changes; without the second, its pre-install reinstalls over the tarballs.

### 4. Run per target (child agents)

`spawn_agent` a child per in-scope target and poll `show_agent` until terminal - do not barrier on the
slowest. Inject the appropriate `run-nx-migration` child block (mode 1: full, `<REGISTRY>`=verdaccio;
mode 2: Run-only; mode 3: Run-only plus its "one migration instead of the whole list" note), filling
`<VERSION>` and `<BRANCH>` (e.g. `test-nx-<VERSION>`). Each child carries its own sandbox (see the
pnpm-sandbox gotcha in `run-nx-migration`).

A child IS the agent nx hands prompt-based migrations to, and nx says so: it logs that it skipped its
own nested agentic flow because the run came from inside an agent. In modes 1 and 2 the prompts land in
`tools/ai-migrations/**/*.md`; in mode 3 nx prints an `<nx_migrate_prompt migration="...">` block on
stdout instead. Either way the child applies them and reports what it did, per step 8 of the shared
block.

### 5. Validate (the product)

Validation is the point of this skill, so go past the graph-resolves check `run-nx-migration` already
does. Per target, run and record pass/fail:

```bash
NX_NO_CLOUD=true NX_DAEMON=false nx run-many -t lint typecheck build --skip-nx-cache
NX_NO_CLOUD=true NX_DAEMON=false nx run-many -t test --skip-nx-cache   # where feasible
```

A failure to **resolve the project graph** (e.g. the removed-eslint-rule crash) shows up here as a hard
failure, not a task failure. Attribute each failure to the migration that caused it.

### 6. Review scope + report

**Review scope - `--focus`** narrows what the report EXPANDS on; it never changes what ran or hides a
failure. Applies to modes 1/2 (mode 3 is already a single migration). A single `--focus` flag,
comma-separated / repeatable, each entry one of:

- `<package>` - all migrations in that package (e.g. `@nx/eslint`)
- `<package>#<name>` - one migration; optional `@<version>` suffix disambiguates a name reused across
  versions
- `commit:<sha>` or `commit:<sha1>..<sha2>` - migrations authored in that commit/range

Omitting `--focus` = everything in focus. Resolve every selector to a flat set of `(package, name)`
identities before reporting (see step 7 for `commit:` resolution). Then render two tiers:

- **in-focus** migrations expanded: the diff they produced, run logs, and the per-repo pass/fail matrix.
- **out-of-focus** migrations collapsed to one line each - never omitted, and every failure shown
  regardless of tier. This is what keeps "the rest visible" while you concentrate on the relevant ones.

**Empty scope.** If a repo subset or `--focus` resolves to nothing (e.g. `commit:` touched no migration),
warn and `AskUserQuestion` whether to run/report against all or abort to retry with a corrected selector -
never silently render an empty result.

Final report: one pass/fail row per (target, migration), the in-focus detail, and every failure with the
migration that caused it. Leave fixes to the author.

### 7. `--focus` resolution

- `<package>` / `<package>#<name>[@<version>]` - a direct `(package, name)` identity (or all names in a
  package).
- `commit:<sha>` / `commit:<sha1>..<sha2>` - resolve to the migrations authored in that commit/range:
  diff the commit(s) against each package's `migrations.json` for entries added/changed, and
  `git log --follow` the implementation files. Yields `(package, name)` tuples.

Authoring-session scoping is intentionally NOT supported: the only link (the `Claude-Session:` commit
trailer) is best-effort and absent on hand-authored commits. To scope to a session's work, use
`commit:<range>` over that session's commits.

## Optional CI-validation PR (opt-in, OFF by default)

Local validation (step 5) is the default. For the highest-fidelity signal - the target's full CI matrix -
optionally open a throwaway **validation** PR. This is a CI harness, not a migration delivery; it is the
`pack-and-copy` phase-4 flow, and it is off unless the author asks for it.

- Available only with the **mode 2/3 tarball substrate**, NOT mode 1 verdaccio: remote CI runners cannot
  reach a localhost registry, whereas pack-and-copy commits `.polygraph-packages/*.tgz` so a fresh CI
  clone installs the `file:` deps. Surface this asymmetry when the author asks for CI on a mode-1 run.
- Per opted-in target: commit the migration edits + the `.polygraph-packages/*.tgz` + the
  `package.json`/lockfile `file:` swaps on a throwaway branch.
- `push_branch` + `create_pr` (draft) via the `polygraph` skill; the body states it is validation-only for
  an unmerged nx change.
- `await-polygraph-ci` to collect the CIPE; fold pass/fail into the per-repo report.
- **Mandatory cleanup:** close the PR and delete the branch. Never merge - these are validation only.

## Mode 3 notes (single migration)

The migration id is `<package>:<name>`, e.g. `@nx/eslint:remove-removed-typescript-eslint-extension-rules`.
A bare `<name>` also works when it matches exactly one entry in `migrations.json`; nx errors and lists the
candidates when it matches several, and a name that itself contains `:` must use the full id.

Mode 3 exercises less than mode 2 by design, so it is an iteration loop rather than a sign-off. It skips
everything mode 2 already skips (collection, package updates, temp-CLI install) and additionally never
sees the other migrations, so it cannot catch a migration that only breaks in combination with an earlier
one. Re-run mode 2 before calling the migration validated.

Per-migration commits are off unless `--create-commits` (or `migrate.createCommits` in the target's
`nx.json`) asks for them, which keeps the child's commit-by-hand step unchanged. Do not pass a custom
`--commit-prefix` containing shell metacharacters: nx re-joins its argv into a shell string when it hands
off to the workspace-local nx, so a `(` in the prefix crashes the run.

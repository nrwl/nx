---
name: test-unreleased-migration
description: Test UNRELEASED nx migrations - ones that live only in a local working tree, branch, or PR (a local publish at most, never an upstream release) - against the real downstream repo set (ocean, nx-labs, nx-examples, nx-console). Sources the migrations locally, runs them, validates each repo (project graph resolves + lint/typecheck/build, optionally CI), reviews the diff, and reports pass/fail per repo. Does NOT open real migration PRs. Use when asked to "test a migration against the real repos", "try this migration on ocean/nx-console", "validate my unreleased migration", or before merging/releasing a migration authored with `author-migration`.
allowed-tools: Bash, Read, Write(tmp/notes/**), Grep, Glob, AskUserQuestion, Agent, Skill(polygraph:polygraph), Skill(run-nx-migration), Skill(polygraph:pack-and-copy), Skill(polygraph:await-polygraph-ci), mcp__plugin_polygraph_polygraph-mcp__show_session, mcp__plugin_polygraph_polygraph-mcp__add_repo, mcp__plugin_polygraph_polygraph-mcp__pack_and_copy, mcp__plugin_polygraph_polygraph-mcp__push_branch, mcp__plugin_polygraph_polygraph-mcp__create_pr
---

# Test an unreleased nx migration against the real repos

Run migrations that exist only in a local nx build (a working tree, a branch, a PR) against
the real downstream repos and report what breaks, before the migration is merged or released.
This closes the gap where an author cannot exercise a migration until it ships, which pushes
the testing burden onto ocean and nx-console after the fact.

This skill runs, validates, reviews, and reports. It does NOT fix and does NOT open real
migration PRs. The author fixes with `author-migration` and re-invokes this skill.

Companion pieces this skill composes (do not reimplement any of them):

- `run-nx-migration` for the per-repo run mechanics (package-manager handling, the
  `--create-commits` crash, applying deferred AI migrations, the graph-resolves verify) and
  the run gotchas. Its child block is injected into each per-repo child.
- `polygraph:polygraph` for session lifecycle, `add_repo`, `spawn_agent`, `push_branch`,
  `create_pr`.
- `polygraph:pack-and-copy` to pack the local nx and install the tarballs into each consumer
  as `file:` deps. Its phase 2 (building the publisher) is explicitly not automatable, phase 3
  packs and rewrites `package.json`, and phase 4 installs and commits.
- `polygraph:await-polygraph-ci` for the optional validation-PR tier. It polls to terminal
  over the session's PRs rather than returning a single result.

## Roles

- **Publisher** = the repo holding the unreleased nx (normally the nrwl/nx checkout you are in).
- **Targets** = the downstream repos to test against. Default set: `ocean`, `nx-labs`, `nx-examples`,
  `nx-console` (all `nrwl`). nrwl/nx itself is the publisher, not a target.

## Input

- The unreleased nx source: the local nrwl/nx checkout on the branch/PR under test.
- The migration(s) under test, as `<package>:<name>` ids. Read the names straight out of the
  authoring collection, e.g. `packages/eslint/migrations.json`. The id is the **entry key**,
  which usually carries a version prefix (`@nx/eslint:update-23-1-0-convert-to-flat-config`),
  not the implementation file's basename.
- **`<VERSION>`**, the version the migrations target: the `version` field on those entries.
  Everything downstream keys off it, so read it rather than guessing a release number.
- **The "from" version**, per target: what that repo has installed _before_ delivery. Capture it
  in step 2; the delivery overwrites it.
- Mode: 1, 2, or 3 (below). If unspecified, default to mode 2 (fast, no publish).
- Target repos: all of the default set or a subset (see step 1).
- `--focus`: optional review/report narrowing (see `reference/focus.md`).

## Execution modes

Pick how much of the real `nx migrate` pipeline to exercise. More coverage costs more time.

| Mode                    | Exercises                                                                                 | Delivery                                                                                  | When                                          |
| ----------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| **1. Full**             | package updates + migration collection + registry resolution + temp-CLI install + run all | verdaccio local publish, then `nx migrate <VERSION>`                                      | most comprehensive; slowest                   |
| **2. All migrations**   | run the whole `migrations.json`, no collection / package update / temp-CLI                | pack-and-copy tarballs + a produced `migrations.json`, then `nx migrate --run-migrations` | fast validation of every migration            |
| **3. Single migration** | run one migration out of the list, nothing else                                           | same tarballs + `migrations.json`, then `nx migrate --run-migration=<package>:<name>`     | fastest loop while iterating on one migration |

Mode 3 exercises less than mode 2 by design, so it is an iteration loop rather than a sign-off:
it never sees the other migrations, so it cannot catch a break that only appears in combination
with an earlier one. It also needs nx 23.2.0 or newer in the target, because that is where
`--run-migration` ships. Re-run mode 2 before calling a migration validated.

## Procedure

### 1. Session + run scope (target repos)

Use the `polygraph:polygraph` skill to start or join the session, then `add_repo` the publisher
(nrwl/nx) and the target repos so their work and any PRs link under one session.

**Run scope.** If the invocation names target repos, use them. If it does not, prompt with
`AskUserQuestion` (all of the default set vs a chosen subset) before starting; do not assume all.

### 2. Record the baseline, then build the publisher

Per target, record the installed nx version **before touching anything**. This is the `--from`
bound, and delivery destroys it:

```bash
node -p "require('<target-repo>/node_modules/nx/package.json').version"
```

Then build the publisher packages so they are packable/publishable: `pnpm build` in the nrwl/nx
checkout. Confirm the changed packages have `dist/` output before delivering; a prompt-only
migration's markdown ships from `dist/`, so an unbuilt package produces a migration that cannot
be staged.

### 3. Create the test branch in each target

Do this **before** delivery. Delivery rewrites `package.json` and the lockfile, and `git checkout -B`
against a dirty tree aborts:

```bash
git fetch origin <base> && git checkout -B test-nx-<VERSION> origin/<base>
```

### 4. Deliver the local nx into each target, by mode

- **Mode 1 (verdaccio).** Publish the local build to the local registry, then let each target
  resolve `<VERSION>` from it. Clear the package-manager caches first, or stale entries resolve
  old versions:

  ```bash
  pnpm store prune --force && rm -rf ~/Library/Caches/pnpm && npm cache clean --force && rm -rf ~/.npm/_npx && bun pm cache rm
  ```

  Then, in the publisher: `pnpm local-registry` in one shell; in another,
  `npm adduser --registry http://localhost:4873` (any credentials work, e.g. test/test/test@test.io;
  publishing just needs a login), then `pnpm nx-release <VERSION> --local`. `<VERSION>` must be
  greater than every target's recorded "from" version, or `nx migrate` finds nothing to do.

  Each target then runs the full `run-nx-migration` child block with `<REGISTRY>` pointed at the
  local verdaccio, and needs `NX_SKIP_PROVENANCE_CHECK=true`: locally published packages carry no
  provenance attestations, and `nx migrate` refuses them without it.

- **Modes 2 and 3 (pack-and-copy tarballs).** Invoke `polygraph:pack-and-copy` to pack the changed
  packages and install the tarballs into each target as `file:` deps. Include `nx` itself in the
  packed set: mode 3's `--run-migration` is a flag on the workspace-local nx, and both modes need
  the local migration implementations.

### 5. Produce `migrations.json` (modes 2 and 3)

The generate phase resolves migration metadata from a registry, so it cannot see the local build.
The producer stands in for it, reading collections out of the target's own `node_modules` (the
published layout, where the `./dist/...` implementation and prompt paths resolve):

```bash
node .claude/skills/test-unreleased-migration/scripts/produce-migrations-json.mjs \
  --target-root <target-repo> \
  --from <recorded-from-version> --to <VERSION> \
  --expect <package>:<name>
```

`--expect` is the guard against a silent false pass: it fails, and writes nothing, unless the
migration under test survives both the version window and its `requires` gate. **Always pass it.**
For mode 3, add `--packages <package>` to keep the file to the migration's own package.

The producer mirrors three things the generate phase does: the `(from, to]` filter, the `requires`
gate the run phase never rechecks, and copying each prompt migration's markdown into
`tools/ai-migrations/` with the entry repointed at that workspace-relative path.

### 6. Run per target (child agents)

Delegate one child per in-scope target through the `polygraph:polygraph-delegate-subagent`, running
in the background. It owns `spawn_agent` and `show_agent`, which the `polygraph:polygraph` skill
requires be driven from a subagent rather than called directly. Launch every in-scope target and fold
each report in as it lands; do not barrier on the slowest.

Give each delegation the appropriate `run-nx-migration` child block, filling `<VERSION>` and
`<BRANCH>` = `test-nx-<VERSION>`:

- **Mode 1**: the full block, `<REGISTRY>` = the local verdaccio.
- **Modes 2 and 3**: the pre-staged path (steps 1 and 2 already done in step 3 above, delivery
  replaces step 5, then steps 7 to 11), run with
  `NX_MIGRATE_USE_LOCAL=true nx migrate --skip-install --run-migrations` (mode 2) or
  `--run-migration=<package>:<name>` (mode 3). `NX_MIGRATE_USE_LOCAL` keeps nx from spawning a temp
  `nx@latest` that carries none of the local changes; `--skip-install` suppresses both the pre-install
  and the post-migration dependency install, either of which would reinstall over the tarballs.

Each child carries its own sandbox (see the pnpm-sandbox gotcha in `run-nx-migration`).

A child IS the agent nx hands prompt-based migrations to, and nx says so: it logs that it skipped
its own nested agentic flow because the run came from inside an agent. In modes 1 and 2 the prompts
are listed as next steps with their `tools/ai-migrations/**/*.md` paths; in mode 3 nx prints an
`<nx_migrate_prompt migration="...">` block on stdout instead. Either way the child applies them and
reports what it did, per step 8 of the shared block.

### 7. Validate, and prove the migration actually ran

Validation is the point of this skill, so go past the graph-resolves check `run-nx-migration`
already does. Per target, run and record pass/fail:

```bash
NX_NO_CLOUD=true NX_DAEMON=false nx run-many -t lint typecheck build --skip-nx-cache
NX_NO_CLOUD=true NX_DAEMON=false nx run-many -t test --skip-nx-cache   # where feasible
```

A failure to **resolve the project graph** (e.g. the removed-eslint-rule crash) shows up here as a
hard failure, not a task failure.

**A green run is not evidence the migration ran.** nx reports `No changes were made` for a
migration that executed and found nothing to do, which is indistinguishable from one that was
never selected. Before recording a pass, require from each child:

- the migration under test in the run's applied list, and
- its own commit (step 7 of the shared block commits each migration separately) or an explicit
  "ran, no changes were applicable, because ..." statement.

If neither is present, the result is INCONCLUSIVE, not a pass. Report it that way.

Those per-migration commits are also what makes failure attribution possible: attribute each
failure to the migration whose commit introduced it, via `git log`/`git bisect` over the branch.
Without them there is no attribution, only a red run.

### 8. Report

`--focus` narrows what the report EXPANDS on; it never changes what ran or hides a failure. It
applies to modes 1 and 2 (mode 3 is already a single migration). Selector syntax and resolution
live in `reference/focus.md`. Render two tiers:

- **in-focus** migrations expanded: the diff they produced, run logs, and the per-repo pass/fail matrix.
- **out-of-focus** migrations collapsed to one line each, never omitted, with every failure shown
  regardless of tier. This is what keeps the rest visible while you concentrate on the relevant ones.

Final report: one pass/fail/inconclusive row per (target, migration), the in-focus detail, and every
failure with the migration that caused it. Leave fixes to the author.

### 9. Restore the targets

These are real repos. A run leaves `file:` rewrites in `package.json`, a mutated lockfile,
`.polygraph-packages/*.tgz`, tarball contents in `node_modules`, a produced `migrations.json`, a
staged `tools/ai-migrations/`, and a `test-nx-<VERSION>` branch. Unless the optional CI tier below
is running, restore each target once its report is captured: `git checkout <base>`, delete the test
branch, and reinstall from the restored lockfile. In the publisher, stop the local registry if mode 1
started one.

## Optional CI-validation PR (opt-in, OFF by default)

Local validation (step 7) is the default. For the highest-fidelity signal, the target's full CI
matrix, optionally open a throwaway **validation** PR. This is a CI harness, not a migration
delivery; it is the `polygraph:pack-and-copy` phase-4 flow, and it is off unless the author asks.

- Available only with the **mode 2/3 tarball substrate**, NOT mode 1 verdaccio: remote CI runners
  cannot reach a localhost registry, whereas the committed `.polygraph-packages/*.tgz` let a fresh
  CI clone install the `file:` deps. Surface this asymmetry when the author asks for CI on a mode-1 run.
- Per opted-in target: commit the migration edits, the `.polygraph-packages/*.tgz`, and the
  `package.json`/lockfile `file:` swaps on a throwaway branch.
- `push_branch` + `create_pr` (draft) via the `polygraph:polygraph` skill; the body states it is
  validation-only for an unmerged nx change.
- `polygraph:await-polygraph-ci` to collect the CIPE; fold pass/fail into the per-repo report.
- **Mandatory cleanup:** close the PR and delete the branch, then do step 9. Never merge; these are
  validation only.

---
name: test-unreleased-migration
description: Test UNRELEASED nx migrations - ones that live only in a local working tree, branch, or PR (a local publish at most, never an upstream release) - against the real downstream repo set (ocean, nx-labs, nx-examples, nx-console). Sources the migrations locally, runs them, validates each repo (project graph resolves + lint/typecheck/build), reviews the diff, and reports pass/fail per repo. Does NOT open real migration PRs. Use when asked to "test a migration against the real repos", "try this migration on ocean/nx-console", "validate my unreleased migration", or before merging/releasing a migration authored with `author-migration`.
allowed-tools: Bash, Read, Grep, Glob, AskUserQuestion, Agent, Skill(polygraph:polygraph), Skill(run-nx-migration), mcp__plugin_polygraph_polygraph-mcp__show_session, mcp__plugin_polygraph_polygraph-mcp__add_repo
disable-model-invocation: true
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
- `polygraph:polygraph` for session lifecycle, `add_repo`, and `spawn_agent`.

`polygraph:pack-and-copy` is deliberately NOT used: it delivers by tarball, and a tarball cannot
resolve an `@nx/*` package's first-party siblings. Step 4 has the reason and the replacement.

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
- Mode: 1, 2, or 3 (below). If unspecified, default to mode 2 (every migration, no generate phase).
- Target repos: all of the default set or a subset (see step 1).
- `--focus`: optional review/report narrowing (see `reference/focus.md`).

## Execution modes

Pick how much of the real `nx migrate` pipeline to exercise. More coverage costs more time.

| Mode                    | Exercises                                                                                 | Delivery                                                                             | When                                          |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| **1. Full**             | package updates + migration collection + registry resolution + temp-CLI install + run all | verdaccio local publish, then `nx migrate <VERSION>`                                 | most comprehensive; slowest                   |
| **2. All migrations**   | run the whole `migrations.json`, no collection / package update / temp-CLI                | local publish + a produced `migrations.json`, then `nx migrate --run-migrations`     | validate every migration, skipping generate   |
| **3. Single migration** | run one migration out of the list, nothing else                                           | same publish + `migrations.json`, then `nx migrate --run-migration=<package>:<name>` | fastest loop while iterating on one migration |

Mode 3 exercises less than mode 2 by design, so it is an iteration loop rather than a sign-off:
it never sees the other migrations, so it cannot catch a break that only appears in combination
with an earlier one. Re-run mode 2 before calling a migration validated.

`--run-migration` has to exist in the nx the workspace ends up running, which is the one delivery
installs, not the one the target had before. So the requirement is on the delivered build's code,
and the target's own version is irrelevant: a target on nx 22 is as eligible as one on 23.
Delivering a build made from a branch that carries the flag satisfies it by construction.

nx does have a version floor for these flags, and `NX_MIGRATE_USE_LOCAL` is what keeps it out of
the way. Treat that env var as load-bearing, not incidental. Step 6 sets it for modes 2 and 3,
which skips the run-target guard outright (`migrate.ts:3710`), and the temp-install guard
(`:3656`) never fires because nx is running from inside the workspace.

Drop the env var and a prerelease `<VERSION>` is genuinely refused, which matters because a
`<VERSION>` under test is usually a prerelease. Once `latest` resolves at or above the floor, the
run-target guard returns `temp-cli` before it ever reaches its same-version bypass
(`version-skew-guard.ts:91-96`); nx installs to a temp dir, and re-entry from there trips the
temp-install guard, which is a bare `lt` with no bypass. Its own contract says as much: a
workspace pinned to a feature-carrying prerelease is refused there too.

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

Then build the publisher packages so they are publishable: `pnpm build` in the nrwl/nx
checkout. Confirm the changed packages have `dist/` output before delivering; a prompt-only
migration's markdown ships from `dist/`, so an unbuilt package produces a migration that cannot
be staged.

### 3. Create the test branch in each target

Do this **before** delivery. Delivery rewrites `package.json` and the lockfile, and `git checkout -B`
against a dirty tree aborts:

```bash
git fetch origin <base> && git checkout -B test-nx-<VERSION> origin/<base>
```

### 4. Deliver the local nx into each target

**Every mode delivers through the local registry.** Tarballs are not an option, for a structural
reason rather than a speed one: an `@nx/*` package declares its first-party siblings as
`workspace:*`, and packing resolves that to a concrete version the consumer then has to find
somewhere. `npm pack` does not even get that far, leaving `workspace:`/`catalog:` in the manifest
so the install dies with `EUNSUPPORTEDPROTOCOL`. `pnpm pack` resolves both, and the install then
dies with `ETARGET` on the sibling instead. No tool in this flow rewrites a tarball's own
dependencies after packing, so tarball delivery can only satisfy the siblings a target happens to
declare itself. A registry makes all of them resolvable, which is why this is the delivery path for
modes 2 and 3 too.

Publish once, then deliver per mode. Clear the package-manager caches first, or stale entries
resolve old versions:

```bash
pnpm store prune --force && rm -rf ~/Library/Caches/pnpm && npm cache clean --force && rm -rf ~/.npm/_npx && bun pm cache rm
```

Then, in the publisher: `pnpm local-registry` in one shell; in another,
`npm adduser --registry http://localhost:4873` (any credentials work, e.g. test/test/test@test.io;
publishing just needs a login), then `pnpm nx-release <VERSION> --local`. `<VERSION>` must be
greater than every target's recorded "from" version, or `nx migrate` finds nothing to do. This
publishes every package, which is also what keeps a migration's first-party siblings resolvable:
never hand-pick a subset, because a migration routinely reaches packages it does not live in.

- **Mode 1.** Each target runs the full `run-nx-migration` child block with `<REGISTRY>` pointed
  at the local verdaccio, and needs `NX_SKIP_PROVENANCE_CHECK=true`: locally published packages
  carry no provenance attestations, and `nx migrate` refuses them without it. `nx migrate` does
  the version rewrite and install itself.

- **Modes 2 and 3.** There is no generate phase to do the rewrite, so do it explicitly: set `nx`
  and every installed `@nx/*` to `<VERSION>` in the target's `package.json`, then install against
  the local registry with that target's package manager. Load `Skill(run-nx-migration)` for its
  package-manager cheat sheet; Yarn Berry needs `YARN_NPM_REGISTRY_SERVER`, npm/pnpm/bun take
  `--registry`.

**Gate the delivery before going further, in modes 2 and 3.** (Not mode 1: there the child does
the install in step 6, so at this point the target is still on its "from" version by design.) The
producer in step 5 reads collections out of the target's `node_modules`, and step 6 runs with
`--skip-install`, so a delivery that silently did not land leaves every later step reading and
running _published_ code while reporting a clean run. `--expect` does not save you here: it only
fails when the migration id is absent, so an edited version of an already-published migration keeps
its id and passes against the published implementation. Assert both, per target, and stop on either
failure:

```bash
node -p "require('<target-repo>/node_modules/nx/package.json').version"   # must equal <VERSION>
node -p "const c=require('<target-repo>/node_modules/<package>/migrations.json'); Object.keys({...c.schematics, ...c.generators})"   # must contain <name>
```

The second probe merges `schematics` and `generators` because that is what the step 5 producer
reads; every first-party collection uses `generators` today, but do not narrow the probe to it.

**Commit the delivery once both probes pass**, staging only `package.json` and the lockfile.
`run-nx-migration`'s step 6 is what normally isolates the version bump from the migration edits,
and the pre-staged path drops it. Leave the delivery uncommitted and the child's first
per-migration commit swallows it, which destroys the failure attribution step 7 depends on.

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

Give each delegation the appropriate child block from `Skill(run-nx-migration)`, filling `<VERSION>`
and `<BRANCH>` = `test-nx-<VERSION>`:

- **Mode 1**: the full block, `<REGISTRY>` = the local verdaccio.
- **Modes 2 and 3**: the pre-staged path (step 3 above already did child step 1; the child still runs
  step 2, delivery replaces step 5, then steps 7 to 11), run with
  `NX_MIGRATE_USE_LOCAL=true nx migrate --skip-install --run-migrations` (mode 2) or
  `--run-migration=<package>:<name>` (mode 3). `NX_MIGRATE_USE_LOCAL` keeps nx from spawning a temp
  `nx@latest` that carries none of the local changes; `--skip-install` suppresses both the pre-install
  and the post-migration dependency install, either of which would reinstall over the delivered build.

Tell each modes-2/3 child two things the pre-staged path changes. Step 10's re-install has to repeat
the delivery install (same registry, same package-manager flags); a plain one resolves `<VERSION>`
from the public registry and overwrites the build under test. And the produced `migrations.json` and
`tools/ai-migrations/` are run scaffolding, never staged into any commit.

Each child carries its own sandbox (see the pnpm-sandbox gotcha in `run-nx-migration`).

A child IS the agent nx hands prompt-based migrations to, and nx says so: it logs that it skipped
its own nested agentic flow because the run came from inside an agent. In modes 1 and 2 the prompts
are listed as next steps with their `tools/ai-migrations/**/*.md` paths; in mode 3 nx prints an
`<nx_migrate_prompt migration="...">` block on stdout instead. Either way the child applies them and
reports what it did, per step 8 of the shared block.

**Tell the child what this path does and does not print, or it will report the difference as a
migration defect.** A prompt written for the agentic flow may reference `<advisory_context>` and
`<files_changed>`. Those two tag names are produced by the agentic prompt builders only, and never
appear here, so their absence is expected and is not a finding. But do not tell the child the
underlying content is absent, because usually it is not; it just arrives under a different shape,
and which shape depends on the migration's kind:

- **Prompt-only** (no implementation). There is no advisory context and no changed-file list, ever:
  `agentContext` comes from what a migration's implementation returns
  (`execute-migration.ts:417`), and this kind has none. Modes 1 and 2 list the prompt under nx's
  "Next steps" directive; mode 3 prints `<nx_migrate_prompt>` carrying the prompt and
  documentation paths. Inspect changes with git.
- **Hybrid** (generator + prompt). Mode 3 puts the generator half's results in the
  `<nx_migrate_prompt>` payload: `impl.changes` (the changed-file list), plus `impl.agentContext`
  when the generator returned any (`worker.ts:588-600`). Mode 3 is also the only place hybrids are
  excluded from the standalone block, so read the payload instead of waiting for one. In modes 1
  and 2 it is the other way round: the classic loop's hybrid branch (`migrate.ts:2811`) prints
  `<agent_context>` like any other kind, and there is no file list.
- **Generator-only.** A non-hybrid migration's `agentContext` is printed as a standalone
  `<agent_context migration="...">` block, precisely because the run is inside an agent
  (`print-dropped-agent-context.ts`). No `agentContext` returned means no block, correctly.

A validation run that invents prompt defects is worse than one that finds nothing, but a child that
ignores real context because it was told to expect nothing is worse than both.

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

These are real repos. A run leaves `<VERSION>` pins in `package.json`, a mutated lockfile, the
locally published packages in `node_modules`, a produced `migrations.json`, a staged
`tools/ai-migrations/`, and a `test-nx-<VERSION>` branch. Restore each target once its report is
captured: `git checkout <base>`, delete the test branch, remove any `migrations.json` and
`tools/ai-migrations/` still on disk (a run that aborted before the child's cleanup leaves them
untracked, where `git checkout` does not touch them), and reinstall from the restored lockfile.
In the publisher, stop the local registry.

Confirm the restore landed with the same probe step 2 used: the target should read back its
recorded "from" version.

## Verification checklist (per target)

Copy this and check it off. Every box is something a run can silently skip while still looking green.

- [ ] Both step-4 delivery probes passed: `node_modules/nx` at `<VERSION>`, and the migration's own
      key present in the delivered collection (modes 2 and 3)
- [ ] The delivery is its own commit, with `migrations.json` and `tools/ai-migrations/` unstaged
- [ ] `--expect <package>:<name>` passed, so the migration survived the version window and its
      `requires` gate
- [ ] The migration appears in the run's applied list, with its own commit or an explicit "ran, no
      changes were applicable, because ..." statement (neither present means INCONCLUSIVE, not pass)
- [ ] Every prompt migration applied by the child and reported, not left for a human
- [ ] `lint typecheck build` recorded per (target, migration), with each failure attributed to the
      commit that introduced it
- [ ] Target restored: base branch, test branch deleted, no leftover `migrations.json` or
      `tools/ai-migrations/`, and the step-2 probe reads back the recorded "from" version
- [ ] Local registry stopped in the publisher

## CI-validation PR: not currently available

The idea was a throwaway **validation** PR per target, so the target's own CI matrix runs against
the unreleased build. It does not work today, and the reason is the same one that decided step 4's
delivery. Say so plainly when an author asks for it, rather than attempting a run.

A remote CI runner cannot reach the localhost registry every mode now publishes to, so CI needs
either a substrate that travels with the commit or a registry it can actually reach. Committed
tarballs are the obvious first candidate, and they fail for the reason step 4 gives: nothing
rewrites a tarball's own first-party dependencies after packing.

Two paths exist if this becomes worth building. Pack every first-party package with `pnpm pack`
(it resolves `catalog:` and `workspace:*`, which `npm pack` leaves verbatim, though it needs the
publisher installed first or it aborts with `ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`), then
rewrite each tarball's own first-party dependencies to `file:` paths pointing at its siblings in
`.polygraph-packages/` so the set resolves closed. Or expose the local registry at a URL CI can
reach. Both are real work and nobody has asked for either. Until then, step 7's local validation is
the ceiling.

---
name: run-nx-migration
description: Shared per-repo core for running an nx migration correctly - detect the package manager, install so `nx migrate` reads the right "from" version, run migrations without `--create-commits`, apply the deferred AI/prompt migrations, and verify the project graph resolves. Use when asked to migrate a single repo (the current one) to a target nx version, or as the shared per-repo core that `nx-multi-repo-migrate` and `test-unreleased-migration` inject into each per-repo child agent. Not for authoring a migration (that is `author-migration`).
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# Run an nx migration in one repo

The source-agnostic core of "migrate one repo correctly", extracted so
`nx-multi-repo-migrate` and `test-unreleased-migration` share one copy of the
package-manager handling and the hard-won gotchas instead of each keeping their own.

**Migrating the repo you are in?** Follow the child instruction block below yourself,
substituting the parameters. The "how consumers use this skill" framing is for the two
orchestrating skills; the steps are the same either way.

An nx migration run has two phases:

- **Generate** - `nx migrate <VERSION>` resolves the target packages, rewrites
  `package.json`, writes `migrations.json`, and copies every prompt-only migration's
  markdown into `tools/ai-migrations/`.
- **Run** - `nx migrate --run-migrations` applies the entries in `migrations.json`.

## How consumers use this skill

A `spawn_agent` child runs in another repo's checkout and loads THAT repo's
`.claude/skills`, not nrwl/nx's, so a child cannot `Skill()`-invoke this skill. The
parent (running in nrwl/nx) loads this skill and copies the **child instruction block**
below into each child's spawn prompt, filling the parameters. The **gotchas** section is
for the parent to handle while orchestrating (sandbox, env, cleanup).

Parameters the parent fills in:

- `<VERSION>` - the target nx version.
- `<BRANCH>` - the branch the child works on (e.g. `migrate-nx-<VERSION>`).
- `<REGISTRY>` - optional. Omit step 4's registry clause entirely when the target resolves
  from the public npm registry; pass a local registry (e.g. a verdaccio publish) only to
  migrate to a version that is not published upstream.

**Pre-staged `migrations.json` (no Generate phase).** A consumer that produces
`migrations.json` itself and installs the target nx into the repo some other way (e.g. from a
local registry) skips Generate. Keep steps 1 and 2, replace step 5 with its own delivery install,
drop steps 3, 4 and 6, then run steps 7 to 11. Four consequences of dropping those steps:

- **Branch before delivering.** Step 1 must run against a clean tree. A delivery that
  rewrites `package.json` and the lockfile first makes `git checkout -B` abort, so the
  consumer creates the branch before it installs anything.
- **Capture the "from" version before delivering too.** Step 3's probe reads the version
  out of `node_modules`, which the delivery overwrites. Record it first; it is what the
  produced `migrations.json` has to be filtered on.
- **Commit the delivery, and keep the scaffolding out of every commit.** Step 6 is what normally
  isolates the version bump from the migration edits. Without it the delivery's `package.json` and
  lockfile are still uncommitted when step 7 starts committing per migration, so the first commit
  swallows them and per-migration attribution is gone. Commit the delivery before handing over, and
  tell the child that the produced `migrations.json` and `tools/ai-migrations/` are run scaffolding
  that never gets staged.
- **Step 10's re-install has to repeat the delivery install**, same registry and same
  package-manager flags. A plain one resolves the target version from the public registry and
  overwrites the delivered build. Dropping the re-install altogether is not the answer either: a
  migration that added a dependency leaves it uninstalled, and step 9 then fails for a delivery
  reason that reads like a migration bug.

The Run phase resolves each migration's implementation from the repo's `node_modules` by
package + name, so a locally installed nx runs regardless of how it got there. Prompt paths
are read relative to the **workspace root**, not the package, so a pre-staged file must already point at a copy
inside the repo (`tools/ai-migrations/...`); the producing consumer owns that.

**One migration instead of the whole list.** Same pre-staged setup, but step 7 runs
`nx migrate --run-migration=<package>:<name>`. `migrations.json` is still required: the flag
picks one entry out of it rather than replacing it, nx errors out when the file is missing,
and it must sit at the workspace root under exactly that name. A bare `<name>` is accepted
when it matches exactly one entry, and a name that itself contains `:` must use the full id.
The flag has to exist in the nx the workspace actually runs, so the delivered build has to
include `nx` itself; the version the repo had before delivery does not matter. Run it with
`NX_MIGRATE_USE_LOCAL` set, or the floor guard refuses a prerelease build. Two deltas downstream:
per-migration commits are off unless `--create-commits`
(or `migrate.createCommits` in `nx.json`) asks for them, so step 7's commit-by-hand still
applies; and a prompt-only or hybrid migration prints an `<nx_migrate_prompt migration="...">`
block on stdout holding the prompt path, the documentation path, and (for a hybrid) the
generator half's file list. Step 8 still applies, but read the prompt from that block.

## Child instruction block

> Migrate this repository to nx `<VERSION>`.
>
> **First, confirm you are in the right repository, before you touch anything.** Run `git remote -v` and check it is the target you were asked to migrate. If it is the orchestrating repo (the one that spawned you, e.g. `nrwl/nx`), **stop and report that instead of proceeding**. That repo is checked out in place, so its working tree is someone's live work, and a migration run there rewrites their uncommitted changes. Never migrate a repo you were not explicitly given.
>
> 1. **Branch from the current default branch, not the clone's checkout.** Fetch first so you don't inherit a stale clone or an in-place working-dir branch, then create the branch from `origin/<base>` (`master` or `main`): `git fetch origin <base> && git checkout -B <BRANCH> origin/<base>`.
> 2. Detect the package manager from the lockfile (`package-lock.json`=npm, `yarn.lock`=Yarn Berry, `pnpm-lock.yaml`=pnpm, `bun.lock`/`bun.lockb`=bun).
> 3. **Install first, so `node_modules` is at the repo's _current_ (pre-migrate) nx version.** `nx migrate` reads the "from" version from `node_modules`, not `package.json`. If `node_modules` is already at the target, it finds **zero migrations** and silently skips them. Verify with `node -p "require('./node_modules/nx/package.json').version"`.
> 4. Run `nx migrate <VERSION>` (updates `package.json`, writes `migrations.json`, copies prompt migrations into `tools/ai-migrations/`). To resolve the target from a local registry instead of the public one, point the install at `<REGISTRY>`.
> 5. Install again, **mutable**. Do NOT set `CI=true` (it makes Yarn Berry immutable / pnpm frozen, so the install and migrations fail silently). pnpm needs `--config.confirm-modules-purge=false`; Yarn Berry needs `YARN_ENABLE_IMMUTABLE_INSTALLS=false`.
> 6. **Commit the version bump first** (before running migrations, so it stays isolated from the migration edits): stage `package.json` + the lockfile, NOT `migrations.json`, and commit `chore(repo): migrate to nx <VERSION>` (never mention AI/Claude).
> 7. **Run migrations, and do NOT use `--create-commits`.** nx re-joins its argv into a shell string when it hands off to the workspace-local nx, so a `(` in a custom `--commit-prefix` (such as `chore(repo): [nx migration] `) crashes it with `Syntax error: "(" unexpected`, which silently drops migrations. Instead run **one** `nx migrate --run-migrations` pass (apply the whole list, not a subset), then commit each migration's edits by hand, e.g. `chore(repo): [nx migration] <name>` (`git commit -m` handles the parens fine).
> 8. **Apply the AI migrations yourself: you are the agent nx defers them to.** `--run-migrations` applies the deterministic codemods (importantly `update-23-1-0-remove-removed-typescript-eslint-extension-rules`, which strips typescript-eslint v8-removed rules like `@typescript-eslint/no-extra-semi`; leaving one in a flat config **crashes ESLint's loader**, so nx reports "Failed to process project graph" and CI goes red) and defers every prompt-only migration, printing _"Next steps for the AI agent driving this run: apply the deferred prompts."_ That is addressed to **you (the child)**: read each prompt listed there (the markdown lives under `tools/ai-migrations/`) and make the described changes; do NOT leave them for a human. Honor each prompt's "passing baseline": keep lint/typecheck passing, never disable a rule the user explicitly configured, and disable a newly _preset_-enabled rule with a short comment rather than editing source to satisfy it. (nx auto-skipping its _nested_ agentic flow inside an agent is the review skipping, NOT permission to skip the migrations.)
> 9. **Verify before declaring done:** `nx run-many -t lint --skip-nx-cache` must **resolve the project graph** and pass (the removed-rule crash only shows at graph-processing time), plus typecheck/build affected projects where feasible. Fix migration-introduced breaks; surface genuine framework-major incompatibilities (Angular/React/TS majors) for a human rather than hacking around them.
> 10. Delete `tools/ai-migrations/` and `migrations.json`; if migrations changed deps, re-install and commit the lockfile update.
> 11. Report: old version, new version, packages bumped, deterministic migrations run (+ commits), **each AI prompt and how you applied it** (or why N/A), final lint/typecheck/build status, and any unresolved failures such as type/name collisions or framework-major breaks. **Leave true blockers for a human; do not invent workarounds.**

**Completing a partial / already-at-target run.** If `node_modules` is already at the target, `nx migrate <VERSION>` finds **zero** migrations. To (re)apply migrations that a prior run skipped (the deterministic `remove-removed-*` codemod or the AI prompts), regenerate the full list with an explicit `--from`: `nx migrate <VERSION> --from=nx@<original-version>`. Migrations detect already-applied state and no-op, so this safely re-runs only what's missing, then finish with steps 7 to 11 above.

**Skipping the install has two switches, and they are not equivalent.** `NX_MIGRATE_SKIP_INSTALL=true` (or `--skip-install`) suppresses the pre-migration install. Only the `--skip-install` **flag** also suppresses the post-migration install that fires when a migration changes dependencies. On a pre-staged run, pass the flag as well, or that install reinstalls over the delivered build.

**Package-manager cheat sheet:**

| Lockfile                      | PM         | run nx                     | install (mutable)                                                        |
| ----------------------------- | ---------- | -------------------------- | ------------------------------------------------------------------------ |
| `package-lock.json`           | npm        | `npx nx`                   | `npm install`                                                            |
| `yarn.lock` (+ `.yarnrc.yml`) | Yarn Berry | `yarn nx`                  | `yarn install` (with `YARN_ENABLE_IMMUTABLE_INSTALLS=false`)             |
| `bun.lock`/`bun.lockb`        | bun        | `bun nx`                   | `bun install`                                                            |
| `pnpm-lock.yaml`              | pnpm       | `pnpm nx` / `pnpm exec nx` | `pnpm install --no-frozen-lockfile --config.confirm-modules-purge=false` |

**Migrations can rewrite source:** a multi-beta jump (e.g. beta.23 to beta.25) pulls migrations from every intervening version, so it may rewrite real code (e.g. `CreateNodesContextV2` to `CreateNodesContext`). The child should review the non-dep diff before committing. A single-beta jump on an already-current repo often legitimately has none.

## Gotchas the parent handles

These each cost real time on a live run. Plan for them up front.

**Fresh betas/canaries are hidden by release-age gates, and the run then fails** (Generate phase, when resolving a target from a registry). A `<24h`-old target is filtered out by supply-chain age gates in up to three places on an nx-dev box: `~/.npmrc` `min-release-age=1` (npm/bun), `~/.config/pnpm/rc` `minimum-release-age=1440` (pnpm), and a `~/.yarnrc.yml` registry pointed at a local age-gating proxy (`http://localhost:7190`) that is often **down**, giving `ECONNREFUSED`. nx now refuses to substitute a different version for an exact request and aborts with `Fetching nx@<target> resolved to version <other>`, so the failure is loud rather than a silent downgrade to `latest`. Bypass per-command (do NOT edit global config): `npm_config_min_release_age=0 npm_config_minimum_release_age=0` (npm/pnpm/bun), plus for Yarn Berry `YARN_NPM_MINIMAL_AGE_GATE=0`. pnpm's nx-migrate temp-dir `pnpm add` also needs `PNPM_CONFIG_STRICT_DEP_BUILDS=false` (else `ERR_PNPM_IGNORED_BUILDS` aborts it). When Yarn's configured registry is the age-gating proxy **and the target is public**, also set `YARN_NPM_REGISTRY_SERVER=https://registry.npmjs.org/`; when migrating from a local registry, point it at `<REGISTRY>` instead, or the override sends resolution to npmjs and the build under test is never fetched. **Always verify each repo landed on the exact target version.** (Note: pnpm ignores the npm-style `min-release-age` key but honors its own `minimum-release-age`; that's why a pnpm repo may resolve the beta while a yarn/npm sibling fails.)

**pnpm dies under the Bash sandbox; bun/yarn don't.** As of Claude Code 2.1.172 the Bash tool sandboxes by default. pnpm's content-addressed store + `clonefile()` reflink + `node_modules` purge trip macOS rules (`com.apple.provenance` xattr removal, creating `.vscode`/`.idea` dirs in the virtual store) plus outbound TLS, so pnpm `install` fails with `ERR_PNPM_EPERM` / reflink / `Operation not permitted`, while bun and yarn install cleanly. **Polygraph children carry their _own_ sandbox** (`~/.polygraph/config.json`, `agentOptions.claude.sandbox`), separate from `~/.claude/settings.json` `sandbox.enabled`; either one only reaches already-spawned processes after a **restart**. If a pnpm child stops on a sandbox/EPERM error, do **not** let it invent workarounds (xattr stripping, TLS shims, store redirection). Instead, disable the sandbox + restart, or migrate that repo from the **unsandboxed parent**: the initiator repo is in-place, and clones live at `~/.polygraph/sessions/<id>/repos/<org>/<repo>`, so run the same install, migrate, install steps there with the sandbox off, then push.

**The initiator repo runs in-place** in your working dir, so migrating it switches branches and churns `node_modules`. Restore it afterward, or run its migration in a throwaway worktree off the real base (`git worktree add -B <BRANCH> /tmp/wt origin/<base>`) so the working copy is never touched. But a **fresh full install in the worktree duplicates the huge `node_modules`** and can `ERR_PNPM_ENOSPC` (inode/disk pressure on top of the other clones' installs). Avoid it: run the `nx migrate` planning step in the **main checkout** (reuse its already-installed `node_modules` so migrate can bump the whole `@nx/*` group; without `node_modules` it only bumps `nx` itself), copy `package.json`+`migrations.json` onto the worktree branch, restore the main checkout; when there are **no** migrations to run, just `pnpm install --lockfile-only` in the worktree instead of a full install. Clean up the worktree with `git worktree remove` after pushing (the branch ref persists).

**A concrete source collision.** The `CreateNodesContextV2` to `CreateNodesContext` rename migration collided with a vendored local `interface CreateNodesContext extends CreateNodesContextV2`, producing a self-referential `extends CreateNodesContext` (TS2310). Surface it for a human; the minimal fix is aliasing the import: `import { CreateNodesContext as NxCreateNodesContext } from '@nx/devkit'`. (That rewrite is a _beta.24_ migration, so starting from beta.25 skips it entirely.)

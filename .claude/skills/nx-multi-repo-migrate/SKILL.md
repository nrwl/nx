---
name: nx-multi-repo-migrate
description: Migrate several repos to a target nx version (e.g. 23.0.0-beta.25) in one coordinated pass — delegates `nx migrate` + migrations to a Polygraph child agent per repo, then pushes branches and opens linked draft PRs. Use when asked to upgrade/migrate multiple repos to a specific nx version, or when working a Polygraph session whose goal is an nx version bump across repos.
allowed-tools: Bash(npm view *), Read, Write(tmp/notes/**), Grep, Glob, Agent, Skill(polygraph:polygraph), mcp__plugin_polygraph_polygraph-mcp__show_session, mcp__plugin_polygraph_polygraph-mcp__spawn_agent, mcp__plugin_polygraph_polygraph-mcp__show_agent, mcp__plugin_polygraph_polygraph-mcp__push_branch, mcp__plugin_polygraph_polygraph-mcp__create_pr
---

# Nx Multi-Repo Migrate

Migrate a set of repos to one target nx version, then open linked draft PRs. Think of it like a pharmacist filling the same prescription for several patients: same drug (target version), but each patient (repo) has different allergies (package manager quirks) — get those wrong and the dose silently fails.

## Input

- **Target version** — e.g. `23.0.0-beta.25`. Verify it exists: `npm view nx@<version> version`.
- **Repos** — an explicit list, or the repos already in a Polygraph session. When none is given, the **default set** is `nx`, `ocean`, `nx-labs`, `nx-examples`, `nx-console` (all in the `nrwl` org).

## Procedure

### 1. Set up the session

Use the `polygraph` skill to discover repos, select the org, and start (or join) the session. It owns auth and session lifecycle — don't reimplement any of that here.

### 2. Delegate the migration to a child agent per repo

This is the Polygraph way: each repo's work runs in its own child agent (`spawn_agent`), not in the parent. Delegate to every repo in the session — in parallel — and poll with `show_agent` until each is terminal. Hand each child the migration instruction below (substitute the target version).

> Migrate this repository to nx `<VERSION>`.
>
> 1. **Branch from the current default branch, not the clone's checkout.** Fetch first so you don't inherit a stale clone or an in-place working-dir branch, then create the branch from `origin/<base>` (`master` or `main`): `git fetch origin <base> && git checkout -B migrate-nx-<VERSION> origin/<base>`.
> 2. Detect the package manager from the lockfile (`package-lock.json`=npm, `yarn.lock`=Yarn Berry, `pnpm-lock.yaml`=pnpm, `bun.lock`/`bun.lockb`=bun).
> 3. **Install first, so `node_modules` is at the repo's _current_ (pre-migrate) nx version.** `nx migrate` reads the "from" version from `node_modules`, not `package.json` — if `node_modules` is already at the target, it finds **zero migrations** and silently skips them. Verify with `node -p "require('./node_modules/nx/package.json').version"`.
> 4. Run `nx migrate <VERSION>` (updates `package.json`, writes `migrations.json`).
> 5. Install again — **mutable**. Do NOT set `CI=true` (it makes Yarn Berry immutable / pnpm frozen, so the install and migrations fail silently). pnpm needs `--config.confirm-modules-purge=false`; Yarn Berry needs `YARN_ENABLE_IMMUTABLE_INSTALLS=false`.
> 6. **Commit the version bump first** (before running migrations, so it stays isolated from the migration edits): stage `package.json` + the lockfile — NOT `migrations.json` — and commit `chore(repo): migrate to nx <VERSION>` (never mention AI/Claude).
> 7. If `migrations.json` exists, run it with commits + agentic review:
>    `nx migrate --run-migrations --create-commits --commit-prefix="chore(repo): [nx migration] " --agentic`
>    - `--create-commits` lands each applied migration as its own commit, so migration-driven source edits stay isolated and reviewable.
>    - The scoped `--commit-prefix` is **required**: nx's default `chore: [nx migration] ` has no scope and fails commitlint. (Pin the agent with `--agentic=claude-code` if auto-detection picks the wrong one.)
>    - `--validate` (agent-driven validation) is **on by default** once `--agentic` is enabled, so you don't pass it separately.
>    - Caveat: nx auto-skips the agentic flow when it detects it is already inside an AI agent (`Agentic flow skipped: …`), and `--validate` has **no effect inside an outer agent** (or non-interactively without an explicit agent) — so the review only truly runs when the migration executes outside the child-agent context.
> 8. Delete `migrations.json`; if migrations changed deps, re-install and commit the lockfile update.
> 9. Report: old→new version, packages bumped, migrations run (and their commits), and any errors — including type/name collisions (e.g. a repo that pins an older nx and keeps a `*V2` symbol). **Leave those for a human to resolve; do not invent workarounds.**

**Package-manager cheat sheet:**

| Lockfile                      | PM         | run nx                     | install (mutable)                                                        |
| ----------------------------- | ---------- | -------------------------- | ------------------------------------------------------------------------ |
| `package-lock.json`           | npm        | `npx nx`                   | `npm install`                                                            |
| `yarn.lock` (+ `.yarnrc.yml`) | Yarn Berry | `yarn nx`                  | `yarn install` (with `YARN_ENABLE_IMMUTABLE_INSTALLS=false`)             |
| `bun.lock`/`bun.lockb`        | bun        | `bun nx`                   | `bun install`                                                            |
| `pnpm-lock.yaml`              | pnpm       | `pnpm nx` / `pnpm exec nx` | `pnpm install --no-frozen-lockfile --config.confirm-modules-purge=false` |

**Migrations can rewrite source:** a multi-beta jump (e.g. beta.23→beta.25) pulls migrations from every intervening version, so it may rewrite real code (e.g. `CreateNodesContextV2`→`CreateNodesContext`). The child should review the non-dep diff before committing. A single-beta jump on an already-current repo often legitimately has none.

### 3. Push + open a PR per repo, as each child finishes

Don't barrier on the slowest repo. The moment a child reports success, `push_branch` that repo (branch `migrate-nx-<VERSION>`) and `create_pr` for **that repo alone** — so its CI starts immediately and one slow repo (e.g. one stuck fighting the sandbox) doesn't gate the others:

```
for each repo, as its child reaches terminal success (not in a barrier):
  push_branch(repo) → create_pr([repo])
```

The PRs stay **linked** because they all join the same Polygraph session — the link is the session, not the single batched call. Commit-message scope `repo` passes nx's commitlint. Print the Polygraph session URL once all are open.

> **Verify once:** a single batched `create_pr` writes every PR body with its sibling cross-references at creation time; with incremental creation, confirm Polygraph **back-fills** the earlier PRs' bodies with links to the later ones (vs. each PR only linking to the session). If it doesn't back-fill and you need the in-body cross-links, fall back to one batched `create_pr` after all children finish.

## Verification checklist (per repo, before opening PRs)

- [ ] `package.json` nx + `@nx/*` at the target version
- [ ] Migrations **ran** (not skipped because `node_modules` was already at target)
- [ ] `migrations.json` deleted
- [ ] Version-bump commit (`chore(repo): migrate to nx <VERSION>`) present on `migrate-nx-<VERSION>`, plus one `chore(repo): [nx migration] …` commit per applied migration (from `--create-commits`)
- [ ] Any collision/compile errors surfaced in the child's report for a human to resolve

## Gotchas from real runs

These each cost real time on a live 5-repo run. Plan for them up front.

**pnpm dies under the Bash sandbox; bun/yarn don't.** As of Claude Code 2.1.172 the Bash tool sandboxes by default. pnpm's content-addressed store + `clonefile()` reflink + `node_modules` purge trip macOS rules — `com.apple.provenance` xattr removal, creating `.vscode`/`.idea` dirs in the virtual store — plus outbound TLS, so pnpm `install` fails with `ERR_PNPM_EPERM` / reflink / `Operation not permitted`, while bun and yarn install cleanly. **Polygraph children carry their _own_ sandbox** (`~/.polygraph/config.json` → `agentOptions.claude.sandbox`), separate from `~/.claude/settings.json` → `sandbox.enabled`; either one only reaches already-spawned processes after a **restart**. If a pnpm child stops on a sandbox/EPERM error, do **not** let it invent workarounds (xattr stripping, TLS shims, store redirection). Instead, disable the sandbox + restart, or migrate that repo from the **unsandboxed parent**: the initiator repo is in-place, and clones live at `~/.polygraph/sessions/<id>/repos/<org>/<repo>` — run the same install→migrate→install steps there with the sandbox off, then push.

**The base can move after you start.** Step 1 (branch from `origin/<base>`) handles the _initial_ state, but the default branch can still advance **mid-run** — e.g. a separate version-bump PR merges underneath you, as happened when ocean's `main` jumped beta.23→beta.25 below an open migrate PR and turned it **conflicting**. Detect it with the behind-count (`git rev-list --count migrate-nx-<V>..origin/<base>`) and watch for open bump PRs; when the base moves, **redo the branch onto the fresh base** — only the repos whose base actually advanced need it. Redoing onto a newer base can also _shrink_ the diff: a beta.25→rc.0 redo is dep-only, whereas the old beta.23→rc.0 ran 16 migrations and rewrote source.

**The initiator repo runs in-place** in your working dir, so migrating it switches branches and churns `node_modules`. Restore it afterward — or run its migration in a throwaway worktree off the real base (`git worktree add -B migrate-nx-<V> /tmp/wt origin/<base>`) so the working copy is never touched.

**A concrete source collision.** The `CreateNodesContextV2`→`CreateNodesContext` rename migration collided with a vendored local `interface CreateNodesContext extends CreateNodesContextV2`, producing a self-referential `extends CreateNodesContext` (TS2310). Surface it for a human; the minimal fix is aliasing the import: `import { CreateNodesContext as NxCreateNodesContext } from '@nx/devkit'`. (That rewrite is a _beta.24_ migration — starting from beta.25 skips it entirely.)

**Push/auth pitfalls.** (1) The SSH agent can drop mid-run (`communication with agent failed`) — SSH `git push` then fails; retry, or have the user re-`ssh-add`. (2) A read-only `GH_TOKEN` env var can shadow a write-capable keychain login: every write (push, `pr edit`, `pr merge --auto`) returns `Resource not accessible by personal access token`. Prefix gh writes with `env -u GH_TOKEN` to fall back to keychain auth. (3) Polygraph `push_branch` does an internal `pull --rebase`, so it **cannot force-update a rebased branch** — use a direct `git push --force` (SSH/HTTPS) for those.

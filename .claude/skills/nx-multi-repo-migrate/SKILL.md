---
name: nx-multi-repo-migrate
description: Migrate several repos to a target nx version (e.g. 23.0.0-beta.25) in one coordinated pass — delegates `nx migrate` + migrations to a Polygraph child agent per repo, then pushes branches and opens linked draft PRs. Use when asked to upgrade/migrate multiple repos to a specific nx version, or when working a Polygraph session whose goal is an nx version bump across repos.
allowed-tools: Bash(npm view *), Read, Write(tmp/notes/**), Grep, Glob, Agent, Skill(polygraph:polygraph), mcp__plugin_polygraph_polygraph-mcp__show_session, mcp__plugin_polygraph_polygraph-mcp__spawn_agent, mcp__plugin_polygraph_polygraph-mcp__show_agent, mcp__plugin_polygraph_polygraph-mcp__push_branch, mcp__plugin_polygraph_polygraph-mcp__create_pr
---

# Nx Multi-Repo Migrate

Migrate a set of repos to one target nx version, then open linked draft PRs. Think of it like a pharmacist filling the same prescription for several patients: same drug (target version), but each patient (repo) has different allergies (package manager quirks) — get those wrong and the dose silently fails.

## Input

- **Target version** — e.g. `23.0.0-beta.25`. Verify it exists: `npm view nx@<version> version`.
- **Repos** — an explicit list, or the repos already in a Polygraph session.

## Procedure

### 1. Set up the session

Use the `polygraph` skill to discover repos, select the org, and start (or join) the session. It owns auth and session lifecycle — don't reimplement any of that here.

### 2. Delegate the migration to a child agent per repo

This is the Polygraph way: each repo's work runs in its own child agent (`spawn_agent`), not in the parent. Delegate to every repo in the session — in parallel — and poll with `show_agent` until each is terminal. Hand each child the migration instruction below (substitute the target version).

> Migrate this repository to nx `<VERSION>`.
>
> 1. Create and check out branch `migrate-nx-<VERSION>`.
> 2. Detect the package manager from the lockfile (`package-lock.json`=npm, `yarn.lock`=Yarn Berry, `pnpm-lock.yaml`=pnpm, `bun.lock`/`bun.lockb`=bun).
> 3. **Install first, so `node_modules` is at the repo's _current_ (pre-migrate) nx version.** `nx migrate` reads the "from" version from `node_modules`, not `package.json` — if `node_modules` is already at the target, it finds **zero migrations** and silently skips them. Verify with `node -p "require('./node_modules/nx/package.json').version"`.
> 4. Run `nx migrate <VERSION>` (updates `package.json`, writes `migrations.json`).
> 5. Install again — **mutable**. Do NOT set `CI=true` (it makes Yarn Berry immutable / pnpm frozen, so the install and migrations fail silently). pnpm needs `--config.confirm-modules-purge=false`; Yarn Berry needs `YARN_ENABLE_IMMUTABLE_INSTALLS=false`.
> 6. If `migrations.json` exists, run `nx migrate --run-migrations`.
> 7. Delete `migrations.json`; re-install if migrations changed deps.
> 8. Commit all changes: `chore(repo): migrate to nx <VERSION>` (never mention AI/Claude).
> 9. Report: old→new version, packages bumped, migrations run, and any errors — including type/name collisions (e.g. a repo that pins an older nx and keeps a `*V2` symbol). **Leave those for a human to resolve; do not invent workarounds.**

**Package-manager cheat sheet:**

| Lockfile                      | PM         | run nx                     | install (mutable)                                                        |
| ----------------------------- | ---------- | -------------------------- | ------------------------------------------------------------------------ |
| `package-lock.json`           | npm        | `npx nx`                   | `npm install`                                                            |
| `yarn.lock` (+ `.yarnrc.yml`) | Yarn Berry | `yarn nx`                  | `yarn install` (with `YARN_ENABLE_IMMUTABLE_INSTALLS=false`)             |
| `bun.lock`/`bun.lockb`        | bun        | `bun nx`                   | `bun install`                                                            |
| `pnpm-lock.yaml`              | pnpm       | `pnpm nx` / `pnpm exec nx` | `pnpm install --no-frozen-lockfile --config.confirm-modules-purge=false` |

**Migrations can rewrite source:** a multi-beta jump (e.g. beta.23→beta.25) pulls migrations from every intervening version, so it may rewrite real code (e.g. `CreateNodesContextV2`→`CreateNodesContext`). The child should review the non-dep diff before committing. A single-beta jump on an already-current repo often legitimately has none.

### 3. Push + open linked draft PRs

Once every child reports success, `push_branch` each repo (branch `migrate-nx-<VERSION>`), then `create_pr` with all repos in one call to open **linked draft PRs**. Commit-message scope `repo` passes nx's commitlint. Print the Polygraph session URL.

## Verification checklist (per repo, before opening PRs)

- [ ] `package.json` nx + `@nx/*` at the target version
- [ ] Migrations **ran** (not skipped because `node_modules` was already at target)
- [ ] `migrations.json` deleted
- [ ] Commit present on `migrate-nx-<VERSION>` with message `chore(repo): migrate to nx <VERSION>`
- [ ] Any collision/compile errors surfaced in the child's report for a human to resolve

## Gotchas from real runs

These each cost real time on a live 5-repo run. Plan for them up front.

**pnpm dies under the Bash sandbox; bun/yarn don't.** As of Claude Code 2.1.172 the Bash tool sandboxes by default. pnpm's content-addressed store + `clonefile()` reflink + `node_modules` purge trip macOS rules — `com.apple.provenance` xattr removal, creating `.vscode`/`.idea` dirs in the virtual store — plus outbound TLS, so pnpm `install` fails with `ERR_PNPM_EPERM` / reflink / `Operation not permitted`, while bun and yarn install cleanly. **Polygraph children carry their _own_ sandbox** (`~/.polygraph/config.json` → `agentOptions.claude.sandbox`), separate from `~/.claude/settings.json` → `sandbox.enabled`; either one only reaches already-spawned processes after a **restart**. If a pnpm child stops on a sandbox/EPERM error, do **not** let it invent workarounds (xattr stripping, TLS shims, store redirection). Instead, disable the sandbox + restart, or migrate that repo from the **unsandboxed parent**: the initiator repo is in-place, and clones live at `~/.polygraph/sessions/<id>/repos/<org>/<repo>` — run the same install→migrate→install steps there with the sandbox off, then push.

**Clones can lag the repo's real base.** A Polygraph clone may sit on an older commit than the repo's live default branch — e.g. a repo migrated "from" beta.23 while its `main` was already beta.25, because a prior version-bump PR hadn't merged. This gives a stale "from" version and a **conflicting** PR. Before migrating: `git fetch origin <base>`, check the behind-count (`git rev-list --count migrate-nx-<V>..origin/<base>`), and look for an open bump PR. When the base moves (or that PR merges), **redo the branch onto the fresh base** — only the repos whose base actually advanced need it. Redoing onto a newer base can also _shrink_ the diff: a beta.25→rc.0 redo is dep-only, whereas the old beta.23→rc.0 ran 16 migrations and rewrote source.

**The initiator repo runs in-place** in your working dir, so migrating it switches branches and churns `node_modules`. Restore it afterward — or run its migration in a throwaway worktree off the real base (`git worktree add -B migrate-nx-<V> /tmp/wt origin/<base>`) so the working copy is never touched.

**A concrete source collision.** The `CreateNodesContextV2`→`CreateNodesContext` rename migration collided with a vendored local `interface CreateNodesContext extends CreateNodesContextV2`, producing a self-referential `extends CreateNodesContext` (TS2310). Surface it for a human; the minimal fix is aliasing the import: `import { CreateNodesContext as NxCreateNodesContext } from '@nx/devkit'`. (That rewrite is a _beta.24_ migration — starting from beta.25 skips it entirely.)

**Push/auth pitfalls.** (1) The SSH agent can drop mid-run (`communication with agent failed`) — SSH `git push` then fails; retry, or have the user re-`ssh-add`. (2) A read-only `GH_TOKEN` env var can shadow a write-capable keychain login: every write (push, `pr edit`, `pr merge --auto`) returns `Resource not accessible by personal access token`. Prefix gh writes with `env -u GH_TOKEN` to fall back to keychain auth. (3) Polygraph `push_branch` does an internal `pull --rebase`, so it **cannot force-update a rebased branch** — use a direct `git push --force` (SSH/HTTPS) for those.

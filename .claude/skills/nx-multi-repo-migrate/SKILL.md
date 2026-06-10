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

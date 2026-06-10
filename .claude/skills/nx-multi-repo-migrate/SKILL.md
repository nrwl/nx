---
name: nx-multi-repo-migrate
description: Migrate several repos to a target nx version (e.g. 23.0.0-beta.25) in one coordinated pass — runs `nx migrate` + migrations per repo, handles each package manager's quirks, then pushes branches and opens linked draft PRs via Polygraph. Use when asked to upgrade/migrate multiple repos to a specific nx version, or when working a Polygraph session whose goal is an nx version bump across repos.
allowed-tools: Bash(git -C *), Bash(git clone *), Bash(git checkout *), Bash(git branch *), Bash(git reset *), Bash(git status *), Bash(git diff *), Bash(git show *), Bash(git add *), Bash(git commit *), Bash(git log *), Bash(git rev-parse *), Bash(git push *), Bash(pnpm *), Bash(yarn *), Bash(bun *), Bash(npx nx *), Bash(npm *), Bash(node *), Bash(node -p *), Bash(python3 *), Bash(rm -f *), Bash(ls *), Bash(grep *), Bash(npm view *), Read, Write(tmp/notes/**), Grep, Glob, Agent, mcp__plugin_polygraph_polygraph-mcp__whoami, mcp__plugin_polygraph_polygraph-mcp__list_accounts, mcp__plugin_polygraph_polygraph-mcp__select_account, mcp__plugin_polygraph_polygraph-mcp__list_repos, mcp__plugin_polygraph_polygraph-mcp__list_sessions, mcp__plugin_polygraph_polygraph-mcp__show_session, mcp__plugin_polygraph_polygraph-mcp__start_session, mcp__plugin_polygraph_polygraph-mcp__add_repo, mcp__plugin_polygraph_polygraph-mcp__push_branch, mcp__plugin_polygraph_polygraph-mcp__create_pr
---

# Nx Multi-Repo Migrate

Migrate a set of repos to one target nx version, then open linked draft PRs. Think of it like a pharmacist filling the same prescription for several patients: same drug (target version), but each patient (repo) has different allergies (package manager quirks) — get those wrong and the dose silently fails.

## Input

- **Target version** — e.g. `23.0.0-beta.25`. Verify it exists: `npm view nx@<version> version`.
- **Repos** — an explicit list, or a Polygraph session whose repos you migrate.
- **The nx source repo itself?** It _dogfoods_ nx (real pinned `@nx/*` deps), so it is a legitimate target — NOT a no-op. Confirm scope with the user before including it.

## The five gotchas (read before running anything)

1. **`nx migrate` reads the FROM version from `node_modules`, not `package.json`.**
   If `node_modules/nx` is already at the target, migrate finds **zero migrations** and silently skips them. After any `git reset` that reverts `package.json` to the base version, you MUST `install` so `node_modules` matches the base **before** running migrate. Verify: `node -p "require('./node_modules/nx/package.json').version"`.

2. **Never set `CI=true` for the install/migration steps.** It makes Yarn Berry immutable and pnpm frozen-lockfile (`YN0028: lockfile would be modified, forbidden`), so the install — and therefore `--run-migrations` — fails and migrations never run. Use real, mutable installs.

3. **pnpm needs `--config.confirm-modules-purge=false`** (otherwise `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` in non-interactive shells). Yarn Berry needs `YARN_ENABLE_IMMUTABLE_INSTALLS=false`.

4. **Delegated child agents can leave junk and lie about success.** Watch for: `npmRegistryServer: http://localhost:4873` (Verdaccio) injected into `.yarnrc.yml`; a stray `package-lock.json` in a yarn repo; "no-op/cancelled" reports that are actually masked failures. Always trust the **git state of the repo**, not the agent's summary. Direct local execution is far more reliable than spawning child agents for this task.

5. **Clean before committing.** Delete `migrations.json`; discard cosmetic `.yarnrc.yml` rewrites (`git checkout -- .yarnrc.yml`); remove any stray `package-lock.json`; verify **no `:4873`** in any lockfile (`grep -c ':4873' <lockfile>` must be 0 — note `localhost`/`verdaccio` can appear benignly inside integrity hashes or as a dev-dep name, so grep for the port `:4873`, not the word).

## Procedure

### 0. Auth & session

- Polygraph auth lives in the macOS Keychain — a **sandboxed shell can't read it** (`polygraph whoami` falsely says "expired"). Use the **MCP** `whoami` instead; it has Keychain access.
- The `polygraph` CLI may lag behind `polygraph-mcp`. If MCP `start_session` fails with `Unknown argument: --name`, create the session by running the CLI directly with **no `--name`**: `polygraph session start --json --repo <org/repo> ...` (one `--repo` per repo). `push_branch`/`create_pr` still work; a "failed to persist session description" sub-error in their result is harmless.
- Confirm the right **org** is selected (`list_accounts` / `select_account`) — repos only appear for orgs you belong to, and a repo must be **connected to Nx Cloud** under that org to be in the graph (there's a sync lag after a UI connect).

### 1. Per-repo migration (the core loop)

For each repo's local checkout (Polygraph session root: `~/.polygraph/sessions/<id>/repos/<org>/<repo>`):

```bash
cd <repo>
unset CI                                    # gotcha #2
export YARN_ENABLE_IMMUTABLE_INSTALLS=false # yarn-berry repos

# 1. clean base
git checkout -b migrate-nx-<VERSION>        # or reset existing branch to its base commit
rm -f migrations.json package-lock.json     # gotcha #4 (package-lock.json only in yarn/pnpm/bun repos)

# 2. make node_modules match the BASE version  (gotcha #1)
<pm> install <mutable flags>
node -p "require('./node_modules/nx/package.json').version"   # must equal base, NOT target

# 3. migrate (updates package.json + writes migrations.json)
<pm> nx migrate <VERSION>

# 4. install to the target
<pm> install <mutable flags>

# 5. RUN migrations, if any
[ -f migrations.json ] && <pm> nx migrate --run-migrations

# 6. clean + finalize  (gotcha #5)
rm -f migrations.json
git checkout -- .yarnrc.yml 2>/dev/null
<pm> install <mutable flags>                # re-sync if migrations changed deps
grep -c ':4873' <lockfile>                  # must print 0

# 7. commit
git add -A && git commit -m "chore(repo): migrate to nx <VERSION>"
```

**Package-manager cheat sheet** (detect from lockfile):

| Lockfile                      | PM         | run nx                     | install (mutable)                                                        |
| ----------------------------- | ---------- | -------------------------- | ------------------------------------------------------------------------ |
| `package-lock.json`           | npm        | `npx nx`                   | `npm install`                                                            |
| `yarn.lock` (+ `.yarnrc.yml`) | Yarn Berry | `yarn nx`                  | `yarn install` (with `YARN_ENABLE_IMMUTABLE_INSTALLS=false`)             |
| `bun.lock`/`bun.lockb`        | bun        | `bun nx`                   | `bun install`                                                            |
| `pnpm-lock.yaml`              | pnpm       | `pnpm nx` / `pnpm exec nx` | `pnpm install --no-frozen-lockfile --config.confirm-modules-purge=false` |

**Corrupt yarn-classic cache** (`Extracting tar content ... appears to be corrupt`): clear the bad entry and retry — `rm -rf ~/Library/Caches/Yarn/v6/*nx*<VERSION>*`.

**Migrations changing source:** a two-beta jump (e.g. beta.23→beta.25) pulls migrations from _both_ betas, so it can rewrite real source (e.g. `CreateNodesContextV2`→`CreateNodesContext`). Review the non-dep diff before committing. A single-beta jump on an already-current repo often legitimately has none.

### 2. Push + draft PRs (via Polygraph MCP)

- `push_branch` per repo (branch `migrate-nx-<VERSION>`). Check the result for "pushed successfully".
- `create_pr` once with all repos in the `prs` array → linked draft PRs. For the nx source repo, fill its PR template (Current Behavior / Expected Behavior / Related Issue(s)); consumers can use a short body. Commit-message scope `repo` passes nx's commitlint.
- Print the Polygraph session URL.

### 3. Cleanup note for the user

If a repo was migrated **in-place** (e.g. an existing local checkout rather than a fresh clone), its `node_modules` is now on the target and the worktree is on the migrate branch. Tell the user to restore it, e.g. `git checkout <default-branch> && <pm> install`.

## Verification checklist (before opening PRs)

- [ ] `package.json` nx + `@nx/*` all at target version
- [ ] Migrations **ran** (not skipped because node_modules was already at target — gotcha #1)
- [ ] `migrations.json` deleted
- [ ] No `:4873` in any lockfile; `.yarnrc.yml` has no injected registry; no stray `package-lock.json`
- [ ] Commit present on `migrate-nx-<VERSION>`, message `chore(repo): migrate to nx <VERSION>`

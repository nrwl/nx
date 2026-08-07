---
name: nx-multi-repo-migrate
description: Migrate several repos to a target nx version (e.g. 23.0.0-beta.25) in one coordinated pass — delegates `nx migrate` + migrations to a Polygraph child agent per repo, then pushes branches and opens linked draft PRs. Use when asked to upgrade/migrate multiple repos to a specific nx version, or when working a Polygraph session whose goal is an nx version bump across repos. The target must already be published upstream; to test an unreleased local build against the repos, use `test-unreleased-migration` instead.
allowed-tools: Bash(npm view *), Read, Grep, Glob, Agent, Skill(polygraph:polygraph), Skill(run-nx-migration), mcp__plugin_polygraph_polygraph-mcp__show_session, mcp__plugin_polygraph_polygraph-mcp__push_branch, mcp__plugin_polygraph_polygraph-mcp__create_pr
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

This is the Polygraph way: each repo's work runs in its own child agent, not in the parent. Delegate to every repo in the session, in parallel, through the `polygraph:polygraph-delegate-subagent` running in the background. It owns `spawn_agent` and `show_agent`, which the `polygraph` skill requires be driven from a subagent rather than called directly.

Hand each child the **child instruction block** from the `run-nx-migration` skill (`Skill(run-nx-migration)`), which owns the per-repo mechanics (package-manager detection and mutable install, the `--create-commits` crash, applying the deferred AI migrations, the graph-resolves verify) plus the run gotchas (release-age gate failures, pnpm under the sandbox, the initiator running in-place, source collisions). Fill its parameters: `<VERSION>` = the target version and `<BRANCH>` = `migrate-nx-<VERSION>`, and drop its `<REGISTRY>` clause, since this skill migrates to a version already on the public registry. Its "completing a partial run" note, package-manager cheat sheet, and "migrations can rewrite source" note apply here unchanged.

### 3. Push + open a PR per repo, as each child finishes

Don't barrier on the slowest repo. The moment a child reports success, `push_branch` that repo (branch `migrate-nx-<VERSION>`) and `create_pr` for **that repo alone** — so its CI starts immediately and one slow repo (e.g. one stuck fighting the sandbox) doesn't gate the others:

```
for each repo, as its child reaches terminal success (not in a barrier):
  push_branch(repo) → create_pr([repo])
```

The PRs stay **linked** because they all join the same Polygraph session — the link is the session, not the single batched call. Commit-message scope `repo` passes nx's commitlint. Print the Polygraph session URL once all are open.

> **Verify once:** a single batched `create_pr` writes every PR body with its sibling cross-references at creation time; with incremental creation, confirm Polygraph **back-fills** the earlier PRs' bodies with links to the later ones (vs. each PR only linking to the session). If it doesn't back-fill and you need the in-body cross-links, fall back to one batched `create_pr` after all children finish.

## Verification checklist (per repo, before opening PRs)

- [ ] `package.json` nx + `@nx/*` at the **exact target version** (not silently downgraded to `latest` by an age gate)
- [ ] Migrations **ran** (not skipped because `node_modules` was already at target), **including** the deterministic `remove-removed-*` codemods
- [ ] AI-migration prompts **applied by the child** (not just written); `tools/ai-migrations/` and `migrations.json` deleted
- [ ] `nx run-many -t lint --skip-nx-cache` **resolves the project graph** and passes; typecheck/build checked where feasible
- [ ] Version-bump commit (`chore(repo): migrate to nx <VERSION>`) plus one `chore(repo): [nx migration] …` commit per applied migration/prompt on `migrate-nx-<VERSION>`
- [ ] Any collision / compile / framework-major errors surfaced in the child's report for a human to resolve

## Gotchas from real runs

These each cost real time on a live 5-repo run. Plan for them up front. The per-repo run gotchas (release-age-gate downgrades, pnpm dying under the sandbox, the initiator running in-place, source collisions) live in the `run-nx-migration` skill; the two below are specific to this skill's multi-repo push/PR flow.

**The base can move after you start.** Branching from `origin/<base>` (step 1 of the shared child block) handles the _initial_ state, but the default branch can still advance **mid-run** — e.g. a separate version-bump PR merges underneath you, as happened when ocean's `main` jumped beta.23→beta.25 below an open migrate PR and turned it **conflicting**. Detect it with the behind-count (`git rev-list --count migrate-nx-<V>..origin/<base>`) and watch for open bump PRs; when the base moves, **redo the branch onto the fresh base** — only the repos whose base actually advanced need it. Redoing onto a newer base can also _shrink_ the diff: a beta.25→rc.0 redo is dep-only, whereas the old beta.23→rc.0 ran 16 migrations and rewrote source.

**Push/auth pitfalls.** (1) The SSH agent can drop mid-run (`communication with agent failed`) — SSH `git push` then fails; retry, or have the user re-`ssh-add`. (2) A read-only `GH_TOKEN` env var can shadow a write-capable keychain login: every write (push, `pr edit`, `pr merge --auto`) returns `Resource not accessible by personal access token`. Prefix gh writes with `env -u GH_TOKEN` to fall back to keychain auth. (3) Polygraph `push_branch` does an internal `pull --rebase`, so it **cannot force-update a rebased branch** — use a direct `git push --force` (SSH/HTTPS) for those. (4) Polygraph `create_pr` intermittently 401s (`Bad credentials`) on **nrwl/nx specifically** while succeeding on sibling nrwl repos in the same batch — just **retry** the failed repo; it usually goes through on the 2nd–3rd attempt. (5) The personal `GH_TOKEN` can **push** to nrwl/nx but is **denied** (403) on some other nrwl repos (e.g. nrwl/nx-examples) and cannot **create PRs** on nrwl/nx — so for those, use Polygraph `push_branch`/`create_pr` (backend auth), and since `push_branch` is fast-forward-only, prefer **adding a new commit over amending** when you need to update an already-pushed branch. nrwl/nx PR creation may still need the pushed-branch + pre-filled compare-URL fallback if `create_pr` keeps failing.

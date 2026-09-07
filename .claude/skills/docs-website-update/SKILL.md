---
name: docs-website-update
description: Sync docs commits from `master` out to the live docs branches in the nx repo: cherry-picks `docs(` / `feat(nx-dev)` commits onto `website-<major>` AND the latest `<major>.<minor>.x` release branch. Use when "update the docs branch", "update nx.dev", "push the latest docs changes out", "cherry-pick docs commits", "sync website-23", "ship docs to the website branch", "update the docs website", "get docs onto the release branch", or any request to move already-merged docs commits from master onto the branches that deploy them.
allowed-tools: Bash(git *), Read, Write
---

# Update Docs Website

This skill works in the `nx` repo only.

CRITICAL:

- If you are not in the `nx` repo, say so and stop working!
- If there are uncommitted/untracked files, say so and stop working!

## Why two branches

Docs commits must land on BOTH:

- `website-<major>` (e.g. `website-23`) - deploys nx.dev for the current major
- the latest release branch `<major>.<minor>.x` (e.g. `23.1.x`) - used for patch releases, and the release pipeline overwrites the `website-<major>` branch from it

If only `website-23` gets the commit, the next patch release from `23.1.x` wipes it.

## How to Update

### 1. Determine the branches

```bash
git fetch origin master
git fetch origin 'refs/heads/website-*:refs/remotes/origin/website-*'
git fetch origin 'refs/heads/*.x:refs/remotes/origin/*.x'
```

- **Website branch**: highest `origin/website-<N>` where `<N>` is an integer.
  Exclude `website-master` and any branch with extra path segments (e.g. `website-19-cherry-01/...`).
  ```bash
  git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/website-*' \
    | grep -E '^origin/website-[0-9]+$' | sort -V | tail -1
  ```
- **Release branch**: highest `origin/<N>.<minor>.x` with the SAME major `<N>` as the website branch.
  ```bash
  git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/*.x' \
    | grep -E "^origin/${MAJOR}\.[0-9]+\.x$" | sort -V | tail -1
  ```
  If no release branch exists for that major, say so and continue with the website branch only.

Report both branch names before doing any work.

### 2. Sync the branches

```bash
git checkout master && git reset --hard origin/master
git checkout <website-branch> && git reset --hard origin/<website-branch>
git checkout <release-branch> && git reset --hard origin/<release-branch>
```

### 3. Build the cherry-pick list (from the website branch)

1. On `<website-branch>`, get the last commit subject -> `/tmp/last-website-commit.txt`
2. Back on `master`, find the commit whose subject matches `/tmp/last-website-commit.txt` -> sha in `/tmp/last-master-sha.txt`
3. On `master`, list commits between that sha and `HEAD`, filtered to subjects starting with `docs(` or `feat(nx-dev)` -> `/tmp/commits-to-cherry-pick.txt` (oldest at bottom, as `git log` prints it)

### 4. Cherry-pick onto the website branch

On `<website-branch>`, oldest to newest:

```bash
git cherry-pick <sha>
```

- On failure: record in `/tmp/failed-website.txt`, `git cherry-pick --abort`, move on.
- If the pick is empty (already applied): `git cherry-pick --skip`, record as skipped.

### 5. Cherry-pick the SAME list onto the release branch

The release branch was cut from `master` at a different point, so some commits may already be there.

1. Skip any commit whose subject already appears in the release branch's log:
   ```bash
   git log <release-branch> --format='%s' | grep -Fxq "<subject>"
   ```
2. Cherry-pick the rest oldest to newest, same rules as step 4.
   - Failures -> `/tmp/failed-release.txt`
   - Empty picks -> `git cherry-pick --skip`

Conflicts are more likely here than on the website branch - do NOT try to resolve them, just abort and report.

### 6. Report

Print a per-branch breakdown:

| Branch | Cherry-picked | Already present / skipped | Failed |
| ------ | ------------- | ------------------------- | ------ |

List failed shas with subjects so they can be handled manually.

Do NOT push. End by reminding which branches have unpushed commits, e.g.:

```
git push origin website-23
git push origin 23.1.x
```

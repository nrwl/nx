---
name: update-cnw-templates
description: Update the CNW (create-nx-workspace) template repos (nrwl/empty-template, nrwl/react-template, etc.) to a target nx version via nx migrate, verify each repo, and open a PR per repo. Clones repos it needs - assumes no local checkout. Use when asked to "update the CNW templates", "migrate the templates to nx X", "bump the template repos", or given a version like "update templates to 23.2.0".
allowed-tools: Bash, Read, Write, Edit, Grep, Glob, WebFetch
---

# Update CNW Templates

Bump every CNW template repo to one target nx version, verify it still builds and
still scaffolds, then open a draft PR per repo. Each template is an independent
GitHub repo under `nrwl/`; `create-nx-workspace --template nrwl/<repo>` clones its
`main` to scaffold a user's workspace. Each repo has a `ci.yml` that lints, tests,
builds, typechecks, and e2es it on PRs - but the consumer path (scaffolding from `main`
via `--template`) isn't covered there, and a force-push to `main` skips PR CI entirely
(how the react template broke). So verify before you ship.

This skill makes **no assumption that the repos are checked out locally.** It clones
what it needs. Anyone on the team can run it from a fresh machine.

## Input

- **Target nx version** - e.g. `23.2.0`. If omitted, use latest stable: `npm view nx@latest version`. Verify it exists: `npm view nx@<version> version`.
- **Repos** - one, several, or (default) all live templates. Names may be given with or without the `-template` suffix.
- **Work dir** - where clones land. Default `./tmp/cnw-templates/` (gitignored). Reuse an existing clone if one is already there and clean.

## The template repos

All live under `nrwl/<name>-template`, push target branch `main`. `--template` accepts
the full `nrwl/<repo>` form for all of them. Four templates also have a bare shorthand.

| Template        | `--template` value              | Shorthand |
| --------------- | ------------------------------- | --------- |
| empty           | `nrwl/empty-template`           | `empty`   |
| typescript      | `nrwl/typescript-template`      | `ts`      |
| react           | `nrwl/react-template`           | `react`   |
| angular         | `nrwl/angular-template`         | `angular` |
| react-mfe       | `nrwl/react-mfe-template`       | -         |
| nextjs          | `nrwl/nextjs-template`          | -         |
| nestjs          | `nrwl/nestjs-template`          | -         |
| express-api     | `nrwl/express-api-template`     | -         |
| astro-starlight | `nrwl/astro-starlight-template` | -         |
| remotion        | `nrwl/remotion-template`        | -         |
| tanstack-start  | `nrwl/tanstack-start-template`  | -         |
| tanstack-ai     | `nrwl/tanstack-ai-template`     | -         |

Before continuing, check that all the templates are live. A repo is live if
`GET https://api.github.com/repos/nrwl/<name>-template/commits/main` returns 200 (a sha).
If you hit 404 report it.

This table may change, and the user will tell you which repos to use (defaults to all in the table).

## Procedure

### 1. Resolve version + repo set

```bash
npm view nx@<version> version                 # confirm target exists
# for each requested repo, confirm it's live:
curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/nrwl/<name>-template/commits/main
```

### 1a. If in a Polygraph session, add the templates to it

If this skill runs inside a Polygraph session (the startup banner names a session ID),
add every target template repo to the session so their per-repo PRs link together under
one session. The repos are exact `owner/repo` refs, so add them directly - no discovery:

```
add_repo(sessionId: "<session-id>", repoIds: ["nrwl/empty-template", "nrwl/react-template", ...])
```

Add only the live repos you're actually touching. After `add_repo`, the PRs you open in
step 5 join the session automatically - the link is the session, not any cross-reference
in the PR bodies. If there's no session, skip this and proceed normally.

### 2. Clone (or reuse) each repo

All template repos are npm (`package-lock.json`). Clone over SSH; the working tree must
be clean before you touch it.

```bash
mkdir -p tmp/cnw-templates && cd tmp/cnw-templates
git clone git@github.com:nrwl/<name>-template.git      # or reuse an existing clean clone
cd <name>-template
git checkout main
git status --porcelain      # MUST be empty; if dirty, skip this repo and report
git fetch origin main && git reset --hard origin/main   # make sure we start from latest origin
grep '"nx"' package.json    # record current version
```

### 3. Migrate

Use `CI=true` to skip prompts.

```bash
CI=true npm install                             # node_modules at current version
CI=true npx nx migrate <target-version>         # updates package.json, writes migrations.json
CI=true npm install                             # apply the dep bump
if [ -f migrations.json ]; then
  CI=true npx nx migrate --run-migrations
  rm -f migrations.json
fi
```

### 4. Verify

```bash
NX_NO_CLOUD=true NX_DAEMON=false CI=true npx nx run-many -t build test lint typecheck --skip-nx-cache
NX_NO_CLOUD=true NX_DAEMON=false CI=true npx nx run-many -t e2e   # where the repo defines it
```

If any target fails, **revert that repo (`git checkout .`) and report** - never open a red PR.

### 5. Commit + PR (per repo)

Every template's `main` is a single "Initial commit" (verified across all 12 repos), so
keep the branch to **one commit** (amend, don't stack) and squash-merge the PR.

```bash
cd tmp/cnw-templates/<name>-template
git checkout -b update-nx-<target-version>
git add -A
git commit -m "chore(deps): update to nx <target-version>"   # never mention AI/Claude
git push -u origin update-nx-<target-version>
# open a draft PR to main via the GitHub API (token from env/1Password, never hardcode):
curl -s -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/nrwl/<name>-template/pulls" \
  -d '{"title":"chore(deps): update to nx <target-version>","head":"update-nx-<target-version>","base":"main","draft":true,"body":"<per-repo summary: old->new nx, migrations run>"}'
```

PR body: old -> new nx version, which migrations ran, and the verification result. For a
not-yet-created repo (404 in step 1), skip the push - report it as "not created".

### 6. Sanity check after the PRs land - run-all-templates.sh

`run-all-templates.sh` (bundled next to this file) runs `create-nx-workspace --template
nrwl/<repo>` for every template and reports pass/fail. It scaffolds from each repo's
**`main`**, so run it as a **follow-up once the template PRs are merged** (or after you
push to `main`) - a real end-to-end check that every template still scaffolds for users.
It can't see an unpushed branch, so it's a post-merge step, not a pre-merge gate.

```bash
# all templates:
CNW_VERSION=<target-version> ./run-all-templates.sh
# a subset:
CNW_VERSION=<target-version> ONLY="empty-template react-template" ./run-all-templates.sh
```

### 7. Report

One table across all repos:

```
| Template        | Previous | Updated | Files | Status         |
| --------------- | -------- | ------- | ----- | -------------- |
| empty-template  | 23.1.0   | 23.2.0  | 2     | PR #NN (draft) |
| nuxt-template   | 23.1.0   | -       | -     | not created    |
```

Be ready to explain any change - which migration produced it and why.

## Notes

- **Always `CI=true`** for nx/npm commands so nothing blocks on a prompt.
- **Never push without confirmation.** Open PRs as **drafts**; the owner reviews and marks ready.
- Patch bumps are usually just `package.json` + lockfile (no `migrations.json`). Minor/major can rewrite source - review the non-dep diff before committing.

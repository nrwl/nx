---
title: 'Migrate a Polyrepo to a Monorepo'
description: 'Move projects out of a polyrepo or multirepo setup into one Nx workspace with nx import, keep their git history, and know which repositories to leave alone.'
sidebar:
  label: Migrate a polyrepo to a monorepo
filter: 'type:Guides'
topics:
  - 'Organizational decisions'
---

{% llm_copy_prompt title="Let an AI agent run the migration" %}

Merge the repositories I name into this Nx workspace, following the instructions on the page below.

1. Ask me which source repositories to import and where each one should land. Confirm the destination workspace already has an Nx setup and a folder convention before touching anything.
2. Order the imports so leaf projects (the ones with no local dependencies) go first, then their consumers.
3. Run `nx import` once per project. Each destination directory must be empty. Pass `--ref` with the source branch, since it is required whenever the command cannot prompt. Preserve git history and do not squash the merge commits.
4. Rewrite every dependency between the imported projects to `workspace:*` (plain `*` on npm, which rejects the workspace protocol), then install. pnpm fails installs on unpublished ranges until this is done; npm and bun mask them by linking any matching local version.
5. Reconcile what `nx import` does not copy: `targetDefaults` (add `"build": { "dependsOn": ["^build"] }` if nothing sets build order), `namedInputs`, plugin entries in `nx.json`, package manager workspace globs, and root ESLint or TypeScript config the imported projects extend.
6. Run `nx sync`, then `nx run-many -t build typecheck lint test` and fix failures until every project passes. Check the targets exist first, since `run-many` exits 0 for targets no project defines, and watch for `typecheck` targets disabled by `noEmit` tsconfigs, which print a notice and pass without checking anything. Report anything you changed in the imported projects rather than silently rewriting their configuration.

Page: {pageUrl}
{% /llm_copy_prompt %}

A polyrepo, also called a multirepo, spreads projects across many repositories.
Merging them into one Nx workspace gives you direct imports instead of published packages, one pull request for changes that cross project lines, and a single project graph that people and AI agents can both read.

`nx import` handles the mechanical part.
It clones a source repository, moves the files into your workspace, keeps the git history, and offers to install the plugins that match the code it found.
The decisions around that command are what determine whether the migration holds up.

## Decide what to merge first

Resist planning a single migration that absorbs every repository at once.
Start with the projects that already change together.

One signal is how often a pull request in one repository forces a follow-up pull request in another within the same week.
Repositories that keep showing up in those pairs belong in the same workspace.
Repositories that never show up together gain little from the move.

Pick one application plus the libraries it consumes and migrate that cluster.
You end up with a workspace that builds, a CI pipeline that runs, and a pattern to repeat.

## What to leave in separate repositories

Not everything should move.
Choose a polyrepo when strict repository-level access control is a hard requirement, or when teams share little code and nothing should force them to move together.
For the full comparison, see [monorepo vs polyrepo](/docs/kb/monorepo-vs-polyrepo).

Access control is the constraint that comes up most, because cloning a repository clones all of it.
Code that contractors, external contributors, or a not-yet-integrated acquisition can read has to live behind its own repository boundary.
A public open source project sitting next to your internal codebase is the same problem in reverse.

The other constraint is agreement.
Teams that answer the [organizational questions](/docs/kb/monorepo-vs-polyrepo#organizational-decisions) differently, on dependency versions, code ownership, or git workflow, and have no intention of converging, will fight the shared repository rather than benefit from it.
Product lines in different domains that share no code are also fine where they are.

Finishing with several monorepos instead of one is a normal outcome.
The split should follow a real boundary.

## 1. Create the destination workspace

Start from an empty workspace and import every project into it, including the ones from the repository you think of as the main one:

```shell
npx create-nx-workspace@latest --template=empty
```

Converting your largest repository in place works too, but then everything you import afterwards has to be reconciled against conventions that were set before the migration started.

Settle your [folder structure](/docs/kb/folder-structure) before importing anything.
`nx import` puts files where you tell it to, so the destination conventions win.
Deciding that applications live in `apps/` and libraries in `packages/` now saves a round of renames later.

{% aside type="caution" title="The destination directory must be empty" %}

`nx import` refuses to write into a destination that already contains git-tracked files:

```plaintext
Destination directory <path> is not empty. Please make sure it is empty before importing into it.
```

Only tracked files count, so ignored build output does not block anything.
Give each project its own destination, such as `packages/ui` and then `packages/data-access`, rather than importing a source `packages/` on top of a destination `packages/` that already holds projects.
If you do target a directory that holds tracked files, including the `packages/.gitkeep` the empty template ships, remove them and commit before importing.

{% /aside %}

## 2. Order the imports

Import leaf projects first, meaning the ones that depend on nothing else you are moving, then work up to the applications that consume them.
Every project then finds its dependencies already present when it lands.

Two things to check before you start:

- Duplicate project names across repositories cause a `MultipleProjectsWithSameNameError`. Rename the conflicting `package.json` names first, including the root `package.json` of each source repository, since that becomes a project too.
- Each import runs an install when it finishes, and with pnpm that install fails with a registry 404 until the dependency ranges are repointed in step 4, regardless of import order. The files still land correctly, so keep going: import everything, repoint, then install once at the end.

## 3. Import each project

Run `nx import` from inside the destination repository.
With no arguments it prompts for what it needs:

```shell
nx import
```

You can pass the source and destination directly.
The source is either a local path or a git URL:

```shell
nx import ../inventory-app apps/inventory
nx import https://github.com/myorg/inventory-app.git apps/inventory
```

When the source is itself a monorepo, use `--source` to pull one directory out of it, and `--ref` to name the branch:

```shell
nx import ../platform packages/ui --source=libs/ui --ref=main
```

The flags worth knowing:

| Flag               | What it does                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `--source`         | The directory inside the source repository to import from. Leave it off to take the whole repository. |
| `--ref`            | The branch to import from. Required whenever you pass `--no-interactive`.                             |
| `--plugins`        | `skip` for none, `all` for everything detected, or a list like `@nx/vite,@nx/jest`.                   |
| `--depth`          | Limits the clone depth, which speeds up large sources at the cost of older history.                   |
| `--no-interactive` | Skips the prompts, so scripts and agents can supply every answer up front.                            |

For every option, see the [nx import reference](/docs/reference/nx-commands#nx-import).

`--ref` is optional when the command can prompt you and required when it cannot, including whole-repository imports where the source has a single branch.
Without it, a `--no-interactive` run stops and reports `"missingFields": ["ref"]` instead of importing.

Each import lands as a merge commit with the source history attached, so `git log` and `git blame` keep working on the moved files.
The underlying mechanism is a `git merge --allow-unrelated-histories` against the reorganized source branch.
To run those steps by hand, or to understand what the command is doing, see [preserving git histories](/docs/kb/preserving-git-histories).

Plugin detection depends on how you import.
A whole-repository import detects the stack and offers the matching plugins, and you should accept them.
A plain TypeScript package with no bundler or test runner has nothing to detect, so an empty plugin list is the expected result rather than a failure.
A subdirectory import does not detect anything, so add plugins yourself with `npx nx add @nx/vite` and check that the plugin `include` patterns cover the directory you imported into.

{% aside type="note" title="Let an agent handle the long tail" %}

`nx import` covers the deterministic part well, and most real migrations still have workspace-specific gaps: a missing runtime, conflicting tooling versions, or a script that reaches outside the project folder.
Run `nx configure-ai-agents` to install the Nx skills, including the `nx import` skill, then prompt your agent to drive the migration and react to the failures as they surface.
See the [AI setup guide](/docs/getting-started/ai-setup) and the [nx import guide](/docs/kb/import-project) for the details.

{% /aside %}

## 4. Point the imported projects at each other

As separate repositories, your projects depended on each other through published version ranges.
That is the definition of the polyrepo you are leaving, and `nx import` does not rewrite it.
What happens next differs by package manager: pnpm keeps resolving those ranges against the registry and fails on anything unpublished, while npm and bun quietly link a local package whenever the range happens to match its version.

Repoint every dependency that now lives in the workspace, so resolution stops depending on a version coincidence. The range to use depends on your package manager:

{% tabs %}
{% tabitem label="pnpm" %}

```json
// packages/api/package.json
{
  "dependencies": {
    "@myorg/utils": "workspace:*"
  }
}
```

Required rather than tidy here. `linkWorkspacePackages` defaults to `false`, so a `^1.0.0` range is fetched from the registry even though the package sits in `packages/utils`, and the install fails with `ERR_PNPM_FETCH_404`.

{% /tabitem %}
{% tabitem label="npm" %}

```json
// packages/api/package.json
{
  "dependencies": {
    "@myorg/utils": "*"
  }
}
```

npm rejects the `workspace:` protocol with `EUNSUPPORTEDPROTOCOL`. It links a local package whenever the range matches, so `*` is enough.

{% /tabitem %}
{% tabitem label="yarn" %}

```json
// packages/api/package.json
{
  "dependencies": {
    "@myorg/utils": "workspace:*"
  }
}
```

{% /tabitem %}
{% tabitem label="bun" %}

```json
// packages/api/package.json
{
  "dependencies": {
    "@myorg/utils": "workspace:*"
  }
}
```

Like npm, bun links a local workspace package whenever the range matches. `workspace:*` makes the intent explicit and refuses to fall back to the registry.

{% /tabitem %}
{% /tabs %}

Dependencies that already used a `workspace:` range inside a source monorepo keep working once both sides are imported. They need no change.

## 5. Reconcile the root configuration

`nx import` moves the project, not the repository around it.
Anything the source project inherited from its own root is left behind, and this is where most post-import build failures come from.

Build ordering is the one to check first, and it applies even when nothing was left behind.
Nothing runs `@myorg/utils:build` before `@myorg/api:build` until a `dependsOn` says so, and an empty workspace ships no `targetDefaults` at all:

```json
// nx.json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

Projects that only typecheck will pass without this and hide the problem. Anything that emits declarations or bundles will fail in ways that look like flaky CI.

If a source repository was itself an Nx workspace, diff its root against yours and carry over what the imported projects rely on:

- `dependencies` and `devDependencies` from the source root `package.json`, when the import took a subdirectory rather than a whole repository. A whole-repository import brings the project's own `package.json` with it.
- The rest of `targetDefaults`, beyond the build ordering above.
- `namedInputs`, particularly the `production` exclusions that keep test files from busting the cache.
- Plugin entries in `nx.json` that the import did not add.

Check the workspace globs after each import.
When the destination directory is not covered by an existing glob, `nx import` registers the literal path, so importing into `apps/web` leaves `packages/*` plus `apps/web` in your `package.json` workspaces or `pnpm-workspace.yaml` rather than `apps/*`.
That entry works, but the next project you add under `apps/` by hand is not a workspace member until you normalize it to a glob.

Subdirectory imports have one more failure mode.
The root `eslint.config.mjs` stays behind while the project configs still reference `../../eslint.config.mjs`, so install the ESLint dependencies and create the root config before running `npx nx add @nx/eslint`.

Run a full install once every project is in place:

{% tabs %}
{% tabitem label="pnpm" %}

```shell
pnpm install --no-frozen-lockfile
```

{% /tabitem %}
{% tabitem label="npm" %}

```shell
npm install
```

{% /tabitem %}
{% tabitem label="yarn" %}

```shell
yarn install --no-immutable
```

{% /tabitem %}
{% tabitem label="bun" %}

```shell
bun install
```

{% /tabitem %}
{% /tabs %}

## 6. Verify the workspace

Sync the TypeScript project references, then run every target across the workspace:

```shell
nx sync
nx run-many -t build typecheck lint test
```

Confirm those targets exist before you trust the result. `run-many` exits 0 for a target no project defines, so a workspace with no `test` target reports success without running anything. `nx show project <name>` lists what a project actually has.

A target can also exist and still check nothing.
When an imported project's tsconfig sets `"noEmit": true`, the workspace's TypeScript plugin creates a `typecheck` target that only prints a disabled notice, and the run still reports success.
The project's own `build` script still typechecks through `tsc`, so rely on that, or remove `noEmit` and adopt the workspace's project-reference setup to make `typecheck` real.

Open the [project graph](/docs/features/explore-graph) and confirm the imported projects show the dependencies you expect.
Edges that are missing here usually mean an unresolved workspace glob or a `package.json` name that no longer matches what consumers import.

Get CI green on the merged workspace before you touch the source repositories.
When it is, archive them read-only rather than deleting them.
The history came along with the import, but open pull requests, issues, and release tags did not.

Caching already works at this point. Two things are worth picking up once the workspace is stable, and an AI agent can set either of them up for you:

- [Module boundaries](/docs/features/enforce-module-boundaries) re-establish the dependency rules that separate repositories used to enforce on their own. Tag the imported projects, then decide which ones are allowed to depend on which.
- Nx Cloud shares cached results across your team and CI, and [code ownership](/docs/kb/code-ownership) routes reviews to the teams that owned each project before the move.

## Repositories you cannot merge

The repositories you decided to leave split are still part of the same system, and agents working in one of them cannot see the consumers of the code they are changing.

[Polygraph](https://trypolygraph.com/), a [meta-harness](https://metaharness.tools) from the Nx team, links separate repositories into a synthetic monorepo so one agent session spans all of them with shared context and coordinated changes.
It is the practical answer for the multiple monorepo setup, where a merged workspace sits next to the public, restricted, or independent repositories that were never going to move.

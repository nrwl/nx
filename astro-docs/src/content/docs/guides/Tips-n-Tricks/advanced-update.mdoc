---
title: Advanced Update Process
description: Learn advanced techniques for updating Nx and workspace dependencies, including step-by-step migration strategies, managing complex updates, and troubleshooting common issues.
filter: 'type:Guides'
---

This guide describes advanced scenarios when it comes to updating Nx and the workspaces dependencies. It starts with a summary of the [standard update process](/docs/features/automate-updating-dependencies) and continues with those advanced use cases.

## Updating to the latest Nx version

The following steps are a summary of the [standard update process](/docs/features/automate-updating-dependencies). For more information on each step, please visit that page.

### Step 1: Updating dependencies and generating migrations

First, run the `migrate` command:

```shell
nx migrate
```

This performs the following changes:

- Updates the versions of the relevant packages in the `package.json` file.
- Generates a `migrations.json` if there are pending migrations.

### Step 2: Running migrations

The next step in the process involves using the `migrate` command to apply the migrations that were generated in the `migrations.json` file in the previous step. You can do so by running:

```shell
nx migrate --run-migrations
```

All changes to your source code will be unstaged and ready for you to review and commit yourself.

### Step 3: Cleaning up

After you run all the migrations, you can remove `migrations.json` and commit any outstanding changes.

## Recommendations

### One major version at a time, small steps

Migrating Jest, Cypress, ESLint, React, Angular, Next, and more is a difficult task. All the tools change at different rates, and they can conflict with each other. In addition, every workspace is different. Even though our goal is for you to update any version of Nx to a newer version of Nx in a single go, sometimes it doesn't work. The recommended process is to update, at most, one major version at a time.

Say you want to migrate from Nx 22.1.0 to Nx 23.0.0. The following steps are more likely to work comparing to `nx migrate 23.0.0`.

- Run `nx migrate 22.7.5` to update the latest version in the 22.x branch.
- Run `nx migrate --run-migrations`.
- Next, run `nx migrate 23.0.0`.
- Run `nx migrate --run-migrations`.

{% aside type="caution" title="Angular updates" %}
If your workspace uses Angular, this becomes a requirement rather than a recommendation. The Angular packages maintain migrations for a single major version at a time. If you try to update over multiple major versions, only the migrations for the latest major version will be applied. This can lead to issues in your workspace.
{% /aside %}

## Crossing multiple major versions

When the target is more than one major version ahead of your installed version, `nx migrate` prompts you to choose how far to jump: migrate to the latest in your current major (recommended), step into the next major, or go directly to the target. To skip the prompt, use `--multi-major-mode`:

- `--multi-major-mode=gradual` migrates to the smallest recommended step (typically the latest in your current major), then tells you to re-run to continue.
- `--multi-major-mode=direct` migrates straight to the target.

The `NX_MULTI_MAJOR_MODE` environment variable is equivalent and takes precedence over a `multiMajorMode` value set in `nx.json`. In non-interactive environments there is no prompt - Nx warns that updating one major at a time is recommended and proceeds directly to the target.

## Choosing which packages to migrate

While in most cases you want to be up to date with Nx and the dependencies it manages, sometimes you might need to stay on an older version of such a dependency. For example, you might want to update Nx to the latest version but keep Angular on **v21.x.x** and not update it to **v22.x.x**.

The `--include` flag controls which packages are updated: `required` (the target package and the packages it ships with), `optional` (the dependency updates those packages recommend), or `all` (the default). The interactive `nx migrate` flow prompts for this. Pass `--include` to set it ahead of time.

`--include` applies only when the target package opts into package selection. Nx and its official plugins do starting in Nx 23, and other plugin authors can opt in as well. For targets that don't, Nx uses `all` without prompting, and passing `--include` explicitly errors. Non-interactive runs also default to `all`.

When unsure, prefer `--include=required` and follow up with `--include=optional`. Updating only Nx and its plugins keeps the PR scope small and has less chance of introducing issues, which matters most in large workspaces. Use `--include=all` when you're okay with doing everything in one PR.

{% aside type="note" title="Optional package updates" %}
You can't choose to skip any arbitrary package update. To ensure that a plugin works well with older versions of a given package, the plugin must support it. Therefore, Nx plugin authors define what package updates are optional.
{% /aside %}

{% aside type="caution" title="Taking control of package updates" %}
While opting out of applying some package updates is supported by Nx, please keep in mind that you are effectively taking control of those package updates and opting out of Nx managing them. This means you'll need to keep up with the version requirements for those packages and those that depend on them. You'll also need to consider more things when updating them at some point [as explained later](#updating-dependencies-that-are-behind-the-versions-nx-manages).
{% /aside %}

### Skipping optional package updates

To skip the optional package updates, generate the migration with `--include=required`:

```shell
nx migrate --include=required
```

Only the target package and the packages it ships with are updated. The `package.json` and the `migrations.json` are generated without the optional dependency updates, and you can catch up on those later.

### Updating dependencies that are behind the versions Nx manages

Once you have skipped some optional updates, there'll come a time when you'll want to update those packages. Run `nx migrate --include=optional` to collect the optional dependency updates recommended for your installed version. It anchors to your installed version, so the target package must be installed and you can't migrate to a version higher than what's installed.

The catch-up can be scoped to a single plugin by naming it as the target. For example, `nx migrate @nx/vite --include=optional` collects only the optional updates `@nx/vite` recommends, such as `vite` itself.

{% aside type="caution" title="Scoping to a single plugin" %}
Some plugin updates depend on other plugins running their updates too. For example, `@nx/angular` sometimes requires the `@nx/js` updates for TypeScript. Scoping the catch-up to a single plugin skips those, so prefer the full `nx migrate --include=optional` when unsure.
{% /aside %}

## Managing migration steps

When you run into problems running the `nx migrate --run-migrations` command, here are some solutions to break the process down into manageable steps.

### Make changes easier to review by committing after each migration runs

Depending on the size of the update (e.g. migrating between major versions is likely to require more significant changes than migrating between feature releases), and the size of the workspace, the overall `nx migrate` process may generate a lot of changes which then need to be reviewed. Particularly if there are then manual changes which need to be made in addition to those made by `nx migrate`, it can make the associated PR harder to review because of not being able to distinguish between what was changed automatically and what was changed manually.

If you pass `--create-commits` to the `--run-migrations` command, Nx will automatically create a dedicated commit for each successfully completed migration, for example:

```shell
nx migrate --run-migrations --create-commits
```

Your git history will then look something like the following:

```text {% title="nx migrate --run-migrations --create-commits" frame="terminal" %}
git log

commit 8c862c780106ab8736985c01de1477309a403548
Author: YOUR_GIT_USERNAME <your_git_email@example.com>
Date:   Thu Apr 14 18:35:44 2022 +0400

    chore: [nx migration] name-of-the-second-migration-which-ran

commit eb83bca97927af26aae731a2cf51ad62cc75efa3
Author: YOUR_GIT_USERNAME <your_git_email@example.com>
Date:   Thu Apr 14 18:35:44 2022 +0400

    chore: [nx migration] name-of-the-first-migration-which-ran

etc
```

By default, nx will apply the prefix of `chore: [nx migration] ` to each commit in order to clearly identify it, but you can also customize this prefix by passing `--commit-prefix` to the command:

```shell
nx migrate --run-migrations --create-commits --commit-prefix="chore(core): AUTOMATED - "
```

```text {% title="git log" frame="terminal" %}
commit 8c862c780106ab8736985c01de1477309a403548
Author: YOUR_GIT_USERNAME <your_git_email@example.com>
Date:   Thu Apr 14 18:35:44 2022 +0400

    chore(core): AUTOMATED - name-of-the-second-migration-which-ran

commit eb83bca97927af26aae731a2cf51ad62cc75efa3
Author: YOUR_GIT_USERNAME <your_git_email@example.com>
Date:   Thu Apr 14 18:35:44 2022 +0400

    chore(core): AUTOMATED - name-of-the-first-migration-which-ran

etc
```

### Customizing which migrations run by altering `migrations.json`

For small projects, running all the migrations at once often succeeds without any issues. For large projects, more flexibility is sometimes needed, and this is where having the separation between generating the migrations to be run, and actually running them, really shines.

All you need to do is amend the JSON file in whatever way makes sense based on your circumstances, for example:

- You may have to skip a migration.
- You may want to run one migration at a time to address minor issues.
- You may want to reorder migrations.
- You may want to run the same migration multiple time if the process takes a long time and you had to rebase.

Because you can run `nx migrate --run-migrations` as many times as you want, you can achieve all of that by commenting out and reordering items in `migrations.json`. The migration process can take a long time, depending on the number of migrations, so it is useful to commit the migrations file with the partially-updated repo alongside any changes which were created by previously completed migrations.

You can even provide a custom location for the migrations file if you wish, you simply pass it to the `--run-migrations` option:

```shell
nx migrate --run-migrations=migrations.json
```

## Using an AI agent to apply migrations

Some migrations ship an AI prompt that an installed agent applies for you. The [agentic flow](/docs/features/automate-updating-dependencies#step-2-run-migrations) is interactive by default, but you can control it with flags:

- `--agentic` enables it and resolves the installed agent. Use `--agentic=claude-code` (or `codex`, `opencode`) to pin one, or `--no-agentic` to disable it.
- `--validate` / `--no-validate` toggles agent validation of generator-only migrations - on by default when the agentic flow is enabled.

A non-interactive `--agentic` run warns and continues without the agent, since the flow requires an interactive terminal. When the flow is enabled, Nx commits each migration separately by default so the agent can review an isolated diff.

To always use the agentic flow (or a specific agent) without passing the flag, set the `agentic` and `validate` options in the [`migrate` section of `nx.json`](/docs/reference/nx-json#migrate).

## Workspace-wide migrate defaults

To avoid passing the same flags on every run, set defaults in the [`migrate` section of `nx.json`](/docs/reference/nx-json#migrate) - `createCommits`, `commitPrefix`, `include`, `multiMajorMode`, `agentic`, and `validate`. A command-line flag always overrides the `nx.json` value, which in turn overrides the built-in Nx defaults.

## Other advanced capabilities

### Overriding versions

Sometimes, you may want to use a different version of a package than what Nx recommends. To do that, specify the package and version:

```shell
nx migrate --to="jest@30.0.0,cypress@15.0.0"
```

By default, Nx uses currently installed packages to calculate what migrations need to run. To override them, override the version:

```shell
nx migrate --to="@nx/jest@12.0.0"
```

{% aside type="caution" title="Overriding versions" %}
By choosing a version different of what Nx recommend you might use a package version that might have not been tested for a given Nx version. This might lead to unexpected issues.
{% /aside %}

### Reverting a failed update

Updates are best done on a clean git history so that it can be easily reversed if something fails. We try our best to make sure migrations do not fail but if one does, **please report it** on [GitHub](https://www.github.com/nrwl/nx/issues/new/).

If an update fails for any reason, you can revert it as you do any other set of changes:

```shell
git reset --hard # Reset any changes
git clean -fd # Delete newly added files and directories
```

{% aside type="caution" title="--create-commits" %}
If using `--create-commits`, you will need to first retrieve the SHA of the commit before your first automated migration commit in order to jump back to the point before the migrations ran, e.g. `git reset --hard YOUR_APPROPRIATE_SHA_HERE`)
{% /aside %}

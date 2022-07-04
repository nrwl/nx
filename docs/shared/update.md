# Updating Nx

The Nx CLI provides the `migrate` command to help you stay up to date with the latest version of Nx.

Not only does `nx migrate` update you to the latest version of Nx, but it also updates the versions of dependencies that we support and test such as Jest and Cypress. You can also use the `migrate` command to update any Nx plugin.

## Migrating to the latest Nx version

Migration happens in two steps:

- The installed dependencies are updated including the `package.json` (and `node_modules`).
- The source code in the repo is updated to match the new versions of packages in `package.json`.

### Step 1: Updating dependencies and generating migrations

First, run the `migrate` command:

```bash
nx migrate latest # same as nx migrate @nrwl/workspace@latest
```

You can also specify the name of the package and the version:

```bash
nx migrate @nrwl/workspace@version # you can also specify version
```

This fetches the specified version of the `@nrwl/workspace` package, analyzes the dependencies and fetches all the dependent packages. The process keeps going until all the dependencies are resolved. This results in:

- The `package.json` being updated
- A `migrations.json` being generated if there are pending migrations.

At this point, no packages have been installed, and no other files have been touched.

Now, you can inspect `package.json` to see if the changes make sense. Sometimes the migration can update a package to a version that is either not allowed or conflicts with another package. Feel free to manually apply the desired adjustments.

{% callout type="note" title="Inspect the changes" %}
At this stage, after inspecting the `package.json`, you may wish to manually run the appropriate install command for your workspace (e.g. `npm install`, `yarn`, or `pnpm install`) but in the next step `nx migrate --run-migrations` will also run this automatically for you.
{% /callout %}

### Step 2: Running migrations

The next step in the process involves using the `migrate` CLI in order to apply the migrations that were generated in `migrations.json` in the previous step.

Each Nx plugin is able to provide a set of migrations which are relevant to particular versions of the package, and so `migrations.json` will only contain migrations which are appropriate for the update to you are currently applying.

The common case is that you will simply apply all migrations from the generated JSON file, exactly as they were generated in the previous step, by running:

```bash
nx migrate --run-migrations
```

This will update your source code in your workspace in accordance with the implementation of the various migrations which ran and all the changes will be unstaged ready for you to review and commit yourself.

#### Make changes easier to review by committing after each migration runs

Depending on the size of the update (e.g. migrating between major versions is likely to require more significant changes than migrating between feature releases), and the size of the workspace, the overall `nx migrate` process may generate a lot of changes which then need to be reviewed. Particularly if there are then manual changes which need to be made in addition to those made by `nx migrate`, it can make the associated PR harder to review because of not being able to distinguish between what was changed automatically and what was changed manually.

If you pass `--create-commits` to the `--run-migrations` command, Nx will automatically create a dedicated commit for each successfully completed migration, for example:

```bash
nx migrate --run-migrations --create-commits
```

Your git history will then look something like the following:

```bash
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

```bash
nx migrate --run-migrations --create-commits --commit-prefix="chore(core): AUTOMATED - "
```

```bash
git log

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

#### Customizing which migrations run by altering `migrations.json`

For small projects, running all the migrations at once often succeeds without any issues. For large projects, more flexibility is sometimes needed, and this is where having the separation between generating the migrations to be run, and actually running them, really shines.

All you need to do is amend the JSON file in whatever way makes sense based on your circumstances, for example:

- You may have to skip a migration.
- You may want to run one migration at a time to address minor issues.
- You may want to reorder migrations.
- You may want to run the same migration multiple time if the process takes a long time and you had to rebase.

Because you can run `nx migrate --run-migrations` as many times as you want, you can achieve all of that by commenting out and reordering items in `migrations.json`. The migration process can take a long time, depending on the number of migrations, so it is useful to commit the migrations file with the partially-updated repo alongside any changes which were created by previously completed migrations.

You can even provide a custom location for the migrations file if you wish, you simply pass it to the `--run-migrations` option:

```bash
nx migrate --run-migrations=migrations.json
```

### Step 3: Cleaning up

After you run all the migrations, you can remove `migrations.json` and commit any outstanding changes.

## Advanced capabilities & recommendations

### One major version at a time, small steps

Migrating Jest, Cypress, ESLint, React, Angular, Next, and more is a difficult task. All the tools change at different rates, they can conflict with each other. In addition, every workspace is different. Even though our goal is for you to update any version of Nx to a newer version of Nx in a single go, sometimes it doesn't work. The following process is better for large workspaces.

Say you want to migrate from Nx 10.1.0 to Nx 11.0.1. The following steps are more likely to work comparing to `nx migrate 11.0.1`.

- Run `nx migrate 10.4.5` to update the latest version in the 10.x branch.
- Run `nx migrate --run-migrations`.
- Next, run `nx migrate 11.0.1`.
- Run `nx migrate --run-migrations`.

### Overriding versions

Sometimes, you may want to use a different version of a package than what Nx recommends. To do that, specify the package and version:

```bash
nx migrate @nrwl/workspace --to="jest@22.0.0,cypress:3.4.0"
```

By default, Nx uses currently installed packages to calculate what migrations need to run. To override them, override the version:

```bash
nx migrate @nrwl/workspace --to="@nrwl/jest@12.0.0"
```

### Reverting a failed update

Updates are best done on a clean git history so that it can be easily reversed if something fails. We try our best to make sure migrations do not fail but if one does, **please report it** on [GitHub](https://www.github.com/nrwl/nx/issues/new/).

If an update fails for any reason, you can revert it as you do any other set of changes:

```bash
git reset --hard # Reset any changes
git clean -fd # Delete newly added files and directories
```

(NOTE: If using `--create-commits` you will need to first retrieve the SHA of the commit before your first automated migration commit in order to jump back to the point before the migrations ran, e.g. `git reset --hard YOUR_APPROPRIATE_SHA_HERE`)

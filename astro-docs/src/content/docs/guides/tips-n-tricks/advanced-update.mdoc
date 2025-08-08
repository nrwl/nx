---
title: Advanced Update Process
description: Learn advanced techniques for updating Nx and workspace dependencies, including step-by-step migration strategies, managing complex updates, and troubleshooting common issues.
---

# Advanced update process

This guide describes advanced scenarios when it comes to updating Nx and the workspaces dependencies. It starts with a summary of the [standard update process](/features/automate-updating-dependencies) and continues with those advanced use cases.

## Updating to the latest Nx version

The following steps are a summary of the [standard update process](/features/automate-updating-dependencies). For more information on each step, please visit that page.

### Step 1: Updating dependencies and generating migrations

First, run the `migrate` command:

```shell
nx migrate latest # same as nx migrate nx@latest
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

Say you want to migrate from Nx 17.1.0 to Nx 18.2.4. The following steps are more likely to work comparing to `nx migrate 18.2.4`.

- Run `nx migrate 17.3.2` to update the latest version in the 17.x branch.
- Run `nx migrate --run-migrations`.
- Next, run `nx migrate 18.2.4`.
- Run `nx migrate --run-migrations`.

{% callout type="warning" title="Angular updates" %}
If your workspace uses Angular, this becomes a requirement rather than a recommendation. The Angular packages maintain migrations for a single major version at a time. If you try to update over multiple major versions, only the migrations for the latest major version will be applied. This can lead to issues in your workspace.
{% /callout %}

## Managing migration steps

When you run into problems running the `nx migrate --run-migrations` command, here are some solutions to break the process down into manageable steps.

### Make changes easier to review by committing after each migration runs

Depending on the size of the update (e.g. migrating between major versions is likely to require more significant changes than migrating between feature releases), and the size of the workspace, the overall `nx migrate` process may generate a lot of changes which then need to be reviewed. Particularly if there are then manual changes which need to be made in addition to those made by `nx migrate`, it can make the associated PR harder to review because of not being able to distinguish between what was changed automatically and what was changed manually.

If you pass `--create-commits` to the `--run-migrations` command, Nx will automatically create a dedicated commit for each successfully completed migration, for example:

```shell
nx migrate --run-migrations --create-commits
```

Your git history will then look something like the following:

```{% command="nx migrate --run-migrations --create-commits" %}
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

```{% command='git log' %}
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

## Choosing optional package updates to apply

While in most cases you want to be up to date with Nx and the dependencies it manages, sometimes you might need to stay on an older version of such a dependency. For example, you might want to update Nx to the latest version but keep Angular on **v15.x.x** and not update it to **v16.x.x**. For such scenarios, `nx migrate` allows you to choose what to update using the `--interactive` flag.

{% callout type="note" title="Optional package updates" %}
You can't choose to skip any arbitrary package update. To ensure that a plugin works well with older versions of a given package, the plugin must support it. Therefore, Nx plugin authors define what package updates are optional.
{% /callout %}

{% callout type="warning" title="Taking control of package updates" %}
While opting out of applying some package updates is supported by Nx, please keep in mind that you are effectively taking control of those package updates and opting out of Nx managing them. This means you'll need to keep up with the version requirements for those packages and those that depend on them. You'll also need to consider more things when updating them at some point [as explained later](#updating-dependencies-that-are-behind-the-versions-nx-manages).
{% /callout %}

### Interactively opting out of package updates

To opt out of package updates, you need to run the migration in interactive mode:

```shell
nx migrate latest --interactive
```

As the migration runs and collects the package updates, you'll be prompted to apply optional package updates, and you can choose what to do based on your needs. The `package.json` will be updated and the `migrations.json` will be generated considering your responses to those prompts.

### Updating dependencies that are behind the versions Nx manages

Once you have skipped some optional updates, there'll come a time when you'll want to update those packages. To do so, you'll need to generate the package updates and migrations from the Nx version that contained those skipped updates.

Say you skipped updating Angular to **v16.x.x**. That package update was meant to happen as part of the `@nx/angular@16.1.0` update, but you decided to skip it at the time. The recommended way to collect the migrations from such an older version is to run the following:

```shell
nx migrate latest --from=nx@16.0.0 --exclude-applied-migrations
```

A couple of things are happening there:

- The `--from=nx@16.0.0` flag tells the `migrate` command to use the version **16.0.0** as the installed version for the `nx` package and all the first-party Nx plugins. Note we use a version lower than the one where the update was meant to happen. This is to account for the fact that the update is normally targeted to a prerelease version for testing it before the final release.
- The `--exclude-applied-migrations` flag tells the `migrate` command not to collect migrations that should have been applied on previous updates.

So, the above command will effectively collect any package update and migration meant to run if your workspace had `nx@16.0.0` installed while excluding those that should have been applied before. You can provide a different older version to collect migrations from.

{% callout type="warning" title="Automatically excluding previously applied migrations" %}
Automatically excluding previously applied migrations doesn't consider migrations manually removed from the `migrations.json` in previous updates. If you've manually removed migrations in the past and want to run them, don't pass the `--exclude-applied-migrations` and collect all previous migrations.
{% /callout %}

### Identifying the Nx version to migrate from to collect previously skipped updates

After running the migrations in interactive mode and opting-out of some package updates, a message is printed to the terminal with the command to run later to collect and apply those skipped updates. For example, if you skipped updating Angular to **v16.0.0**, this is the output you'll see (simplified for brevity):

```shell
nx migrate latest --interactive
Fetching meta data about packages.
It may take a few minutes.
...
✔ Do you want to update to TypeScript v5.0? (Y/n) · false
✔ Do you want to update the Angular version to v16? (Y/n) · false

NX   The migrate command has run successfully.

- package.json has been updated.
- migrations.json has been generated.

NX   Next steps:

- Make sure package.json changes make sense and then run 'pnpm install --no-frozen-lockfile',
- Run 'pnpm exec nx migrate --run-migrations'
- You opted out of some migrations for now. Write the following command down somewhere to apply these migrations later:
- nx migrate 16.5.3 --from nx@16.1.0-beta.0 --exclude-applied-migrations
- To learn more go to https://nx.dev/recipes/other/advanced-update
```

You can see in the "Next steps" section a suggested command to run to apply the skipped package updates. Make sure to store that information somewhere so you can later remember from which version you need to run the migration to apply the skipped package updates.

Please note the suggested command is only based on a particular run of the `nx migrate` command. If you've skipped package updates in previous runs, you'll need to use the oldest version you've stored that you haven't yet run the migration from.

If you don't have the command and need to find out from which version to run the migration, you can take a look at the `migrations.json` file of the relevant package. For example, if you skipped updating Angular to **v16.0.0**, you can take a look at the `migrations.json` file of the `@nx/angular` package and you'll find the following:

```jsonc {% fileName="node_modules/@nx/angular/migrations.json" %}
{
  // ...
  "packageJsonUpdates": {
    // ...
    "16.1.0": {
      "version": "16.1.0-beta.1",
      "x-prompt": "Do you want to update the Angular version to v16?",
      "requires": {
        "@angular/core": ">=15.2.0 <16.0.0"
      },
      "packages": {
        "@angular/core": {
          "version": "~16.0.0",
          "alwaysAddToPackageJson": true
        }
        // ...
      }
    }
    // ...
  }
}
```

You can see the `16.1.0-beta.1` version is the one that contains the update for `@angular/core` to **~16.0.0**. That's the version you need to run the migration from to apply the package update.

## Other advanced capabilities

### Overriding versions

Sometimes, you may want to use a different version of a package than what Nx recommends. To do that, specify the package and version:

```shell
nx migrate latest --to="jest@22.0.0,cypress@3.4.0"
```

By default, Nx uses currently installed packages to calculate what migrations need to run. To override them, override the version:

```shell
nx migrate latest --to="@nx/jest@12.0.0"
```

{% callout type="warning" title="Overriding versions" %}
By choosing a version different of what Nx recommend you might use a package version that might have not been tested for a given Nx version. This might lead to unexpected issues.
{% /callout %}

### Reverting a failed update

Updates are best done on a clean git history so that it can be easily reversed if something fails. We try our best to make sure migrations do not fail but if one does, **please report it** on [GitHub](https://www.github.com/nrwl/nx/issues/new/).

If an update fails for any reason, you can revert it as you do any other set of changes:

```shell
git reset --hard # Reset any changes
git clean -fd # Delete newly added files and directories
```

{% callout type="warning" title="--create-commits" %}
If using `--create-commits`, you will need to first retrieve the SHA of the commit before your first automated migration commit in order to jump back to the point before the migrations ran, e.g. `git reset --hard YOUR_APPROPRIATE_SHA_HERE`)
{% /callout %}

# Advanced update process

This guide describes advanced scenarios when it comes to updating Nx and the workspaces dependencies. It starts with a summary of the [standard update process](/core-features/automate-updating-dependencies) and continues with those advanced use cases.

## Updating to the latest Nx version

The following steps are a summary of the [standard update process](/core-features/automate-updating-dependencies). For more information on each step, please visit that page.

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

While in most cases you want to be up to date with Nx and the dependencies it manages, sometimes you might need to stay on an older version of such a dependency. For example, you might want to update Nx to the latest version but keep Jest on **v27.x.x** and not update it to **v28.x.x**. For such scenarios, `nx migrate` allows you to choose what to update using the `--interactive` flag.

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

Say you skipped updating Jest to **v28.x.x**. That package update was meant to happen as part of the `@nx/jest@14.6.0` update, but you decided to skip it at the time. The recommended way to collect the migrations from such an older version is to run the following:

```shell
nx migrate latest --from=nx@14.5.0 --exclude-applied-migrations
```

A couple of things are happening there:

- The `--from=nx@14.5.0` flag tells the `migrate` command to use the version **14.5.0** as the installed version for the `nx` package and all the first-party Nx plugins
- The `--exclude-applied-migrations` flag tells the `migrate` command not to collect migrations that should have been applied on previous updates

So, the above command will effectively collect any package update and migration meant to run if your workspace had `nx@14.5.0` installed while excluding those that should have been applied before. You can provide a different older version to collect migrations from.

{% callout type="warning" title="Automatically excluding previously applied migrations" %}
Automatically excluding previously applied migrations doesn't consider migrations manually removed from the `migrations.json` in previous updates. If you've manually removed migrations in the past and want to run them, don't pass the `--exclude-applied-migrations` and collect all previous migrations.
{% /callout %}

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

## Recommendations

### One major version at a time, small steps

Migrating Jest, Cypress, ESLint, React, Angular, Next, and more is a difficult task. All the tools change at different rates, they can conflict with each other. In addition, every workspace is different. Even though our goal is for you to update any version of Nx to a newer version of Nx in a single go, sometimes it doesn't work. The following process is better for large workspaces.

Say you want to migrate from Nx 10.1.0 to Nx 11.0.1. The following steps are more likely to work comparing to `nx migrate 11.0.1`.

- Run `nx migrate 10.4.5` to update the latest version in the 10.x branch.
- Run `nx migrate --run-migrations`.
- Next, run `nx migrate 11.0.1`.
- Run `nx migrate --run-migrations`.

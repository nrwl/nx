# Updating Nx

The Nx CLI provides the `migrate` command to help you stay up to date with the latest version of Nx.

Not only does `nx migrate` update you to the latest version of Nx, but it also updates the versions of dependencies that we support and test such as Jest and Cypress. You can also use the `migrate` command to update any Nx plugin.

## What about "ng update?"

**TLDR: So if you are using Nx 10 or later, run `nx migrate latest` instead of `ng update`.**

If you haven't used Nx before and used the Angular CLI, you probably ran `ng update`. What is the difference?

`nx migrate` is a much improved version of `ng update`. It runs the same migrations, but allows you to:

- Rerun the same migration multiple times.
- Reorder migrations.
- Skip migrations.
- Fix migrations that "almost work".
- Commit a partially migrated state.
- Change versions of packages to match org requirements.

And, in general, it is lot more reliable for non-trivial workspaces. Why?

`ng update` tries to perform migration in a single go, automatically. This doesn't work for most non-trivial workspaces.

- `ng update` doesn't separate updating `package.json` from updating the source code of the repo. It all happens in a single go. This often fails for non-trivial workspaces or for organizations that have a custom npm registry, where you might want to use a different version of a package.
- `ng update` relies on `peerDependencies` to figure out what needs to be updated. Many third-party plugin don't have `peerDependencies` set correctly.
- When using `ng update` it is difficult to execute one migration at a time. Sometimes you want to patch things up after executing a migration.
- When using `ng update` it's not possible to fix almost-working migrations. We do our best but sometimes we don't account for the specifics of a particular workspace.
- When using `ng update` it's not possible to commit a partially-migrated repo. Migration can take days for a large repo.
- When using `ng update` it's not possible to rerun some of the migrations multiple times. This is required because you can rebase the branch multiple times while migrating.

The Nx core team have gained a lot of experience migrating large workspaces over the last 4 years, and `nx migrate` has been consistently a lot more reliable and easier to use. It has also been a lot easier to implement migrations that work with `nx migrate` comparing to `ng update`. As a result, folks building React and Node applications with Nx have had better experience migrating because Angular folks use `ng update` out of habit, instead of using the command that works better.

**Starting with Nx 11, you can migrate workspaces only using `nx migrate`**. To reiterate: `nx migrate` runs the migrations written by the Angular CLI team the same way `ng update` runs them. So everything should still work. You just get more control over how it works.

If you ran `ng update` and saw the error telling you to use `nx migrate`, do the following:

- `git checkout .`
- `git clean -f .`
- `rm -rf node_modules`
- `npm install` (or `yarn install`)
- `nx migrate latest`
- `npm install` (or `yarn install`)
- `nx migrate --run-migrations=migrations.json`

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

Now, you can inspect `package.json` to see if the changes make sense. Sometimes the migration can update some package to the version that is either not allowed or conflicts with another package. Feel free to manually apply the desired adjustments.

### Step 2: Install the packages

After inspecting the `package.json`, make sure to install the updated package versions by running `npm install`, `yarn`, or `pnpm install`.

### Step 3: Running migrations

Next, update the repo to match the updated `package.json` and `node_modules`. Every Nx plugin comes with a set of migrations that describe how to update the workspace to make it work with the new version of the plugin. During step one, Nx looked at all of the packages being updated and collected their migrations into `migrations.json`. It's important to note that because Nx knows the from and to versions of every package, the `migrations.json` file only contains the relevant migrations.

Each migration in `migrations.json` updates the source code in the repository. To run all the migrations in order, run the following command:

```bash
nx migrate --run-migrations
```

To specify a custom migrations file, pass it to the `--run-migrations` option:

```bash
nx migrate --run-migrations=migrations.json
```

For small projects, running all the migrations at once often succeeds without any issues. For large projects, more flexibility is needed:

- You may have to skip a migration.
- You may want to run one migration at a time to address minor issues.
- You may want to reorder migrations.
- You may want to run the same migration multiple time if the process takes a long time and you had to rebase.

Because you can run `nx migrate --run-migrations` as many times as you want, you can achieve all of that by commenting out and reordering items in `migrations.json`. The migration process can take a long time, depending on the number of migrations, so it is useful to commit the migrations file with the partially-updated repo.

### Step 4: Cleaning up

After you run all the migrations, you can remove `migrations.json` and commit the changes.

## Advanced capabilities & recommendations

### One major version at a time, small steps

Migrating Jest, Cypress, ESLint, React, Angular, Next, and more is a difficult task. All the tools change at different rates, they can conflict with each other. In addition, every workspace is different. Even though our goal is for you to update any version of Nx to a newer version of Nx in a single go, sometimes it doesn't work. The following process is better for large workspaces.

Say you want to migrate from Nx 10.1.0 to Nx 11.0.1. The following steps are more likely to work comparing to `nx migrate 11.0.1`.

- Run `nx migrate 10.4.5` to update the latest version in the 10.x branch.
- Run `npm install`.
- Run `nx migrate --run-migrations`.
- Next, run `nx migrate 11.0.1`.
- Run `npm install`.
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

# Updating Nx

Nx provides the `migrate` command which help you stay up to date with the latest version of Nx.

Not only `nx migrate` updates the version of Nx, but it also updates the versions of dependencies which we install such as jest and cypress. You can also use the `migrate` command to update any Nx plugin or any Angular package.

## What About "Ng Update?"

**TLDR: So if you are using Nx 10, run `nx migrate latest` instead of `ng update`.**

If you haven't used Nx before and used the Angular CLI, you probably ran `ng update`. What is the difference?

`nx migrate` is a much improved version of `ng update`. It runs the same migrations, but allows you to:

- rerun the same migration multiple times
- reorder migrations
- skip migrations
- fix migrations that "almost work"
- commit a partially migrated state
- change versions of packages to match org requirements

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

## How to Migrate

Migration happens in two steps:

- Updating `package.json` (and `node_modules`)
- Updating the source code of the repo to match the new versions of packages in `package.json`

### Step 1: Updating package.json and generating migrations.json

Run the following:

```bash
nx migrate latest # same as nx migrate @nrwl/workspace@latest
```

You can also specify the name of the package and the version:

```bash
nx migrate @nrwl/workspace@version # you can also specify version
```

This will fetch the specified version of `@nrwl/workspace`, analyze the dependencies and fetch all the dependent packages. The process will keep going until the whole tree of dependencies is resolved. This will result in:

- `package.json` being updated
- `migrations.json` being generated

At this point, no packages have been installed, and no other files have been touched.

Now, you can inspect `package.json` to see if the changes make sense. Sometimes the migration can update some package to the version that is either not allowed or conflicts with with another package. After you are satisfied, run `npm install`, `yarn`, or `pnpm install`.

### Step 2: Running migrations

Next, we need to update the repo to match the updated `package.json` and `node_modules`. Every Nx plugin comes with a set of migrations that describe how to update the workspace to make it work with the new version of the plugin. During Step 1 Nx looked at all of the packages being updated and collected their migrations into `migrations.json`. It's important to note that because Nx knows the from and to versions of every package, the `migrations.json` file only contains the relevant migrations.

Each migration in `migrations.json` updates the source code in the repository. To run all the migrations in order, invoke:

```bash
nx migrate --run-migrations=migrations.json
```

For small projects, running all the migrations at once often succeeds without any issues. For large projects, more flexibility is sometimes needed:

- You may have to skip a migration.
- You may want to run one migration at a time to address minor issues.
- You may want to reorder migrations.
- You may want to run the same migration multiple time if the process takes a long time and you had to rebase.

Since you can run `nx migrate --run-migrations=migrations.json` as many times as you want, you can achieve all of that by commenting out and reordering items in `migrations.json`. The migrate process can take a long time, sometimes a day, so it can be useful to commit the migrations file with the partially-updated repo.

### Step 3: Cleaning up

After you run all the migrations, you can remove `migration.json` and commit the changes.

## Advanced Capabilities & Recommendations

### One Major Version at a Time, Small Steps

Migrating Jest, Cypress, ESLint, React, Angular, Next etc... is a difficult task. All the tools change at different rates, they can conflict with each other etc.. In addition, every workspace is different. Even though our goal is to let you update any version of Nx to any other version in a single go, sometimes it doesn't work. The following process is better for large workspaces.

Say you want to migrate from Nx 10.1.0 to Nx 11.0.1. The following steps are more likely to work comparing to `nx migrate 11.0.1`.

- Run `nx migrate 10.4.5` to update the latest version in the 10x branch.
- Run `npm install`
- Run `nx migrate --run-migrations=migrations.json`
- Next, run `nx migrate 11.0.1`
- Run `npm install`
- Run `nx migrate --run-migrations=migrations.json`

### Overriding versions

Sometimes, you may want to use a different version of a package than what Nx recommends. You can do it as follows:

```bash
nx migrate @nrwl/workspace --to="jest@22.0.0,cypress:3.4.0"
```

By default, Nx uses currently installed packages to calculate what migrations need to run. You can override them like this:

```bash
nx migrate @nrwl/workspace --to="@nrwl/jest@8.0.0"
```

### Reverting a failed update

Updates are best done on a clean git history so that it can be easily reversed if something fails.
We try our best to make sure migrations do not fail but if one does, **please report it** on [Github](https://www.github.com/nrwl/nx/issues/new/).
If an update fails for any reason, you can revert it as you do any other set of changes:

```bash
git reset --hard # Reset any changes
git clean -fd # Delete newly added files and directories
```

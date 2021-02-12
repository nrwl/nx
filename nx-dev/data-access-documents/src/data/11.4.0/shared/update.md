# Updating Nx

Nx provides the `migrate` command which help you stay up to date with the latest version of Nx.

Not only `nx migrate` updates the version of Nx, but it also updates the versions of dependencies which we install such as jest and cypress. You can also use the `migrate` command to update any Nx plugin.

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

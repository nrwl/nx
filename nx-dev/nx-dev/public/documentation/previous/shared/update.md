# Updating Nx

Nx provides migrations which help you stay up to date with the latest version of Nx.

Not only do we migrate the version of Nx, but we also update the versions of dependencies which we install such as jest and cypress.

We recommend waiting for Nx to update these dependencies for you as we verify that these versions work together.

## How to Migrate

### Generate migrations.json

All you have to do to update Nx to the latest version is run the following:

```bash
nx migrate @nrwl/workspace
nx migrate @nrwl/workspace@version # you can also specify version
```

This will fetch the specified version of `@nrwl/workspace`, analyze the dependencies and fetch all the dependent packages. The process will keep going until the whole tree of dependencies is resolved. This will result in:

- `package.json` being updated
- `migrations.json` being generated

At this point, no packages have been installed, and no other files have been touched.

Now, you can inspect `package.json` to see if the changes make sense and install the packages by running `npm install` or `yarn`.

### Run Migrations

`migrations.json` contains the transformations that must run to prepare the workspace to the newly installed versions of packages. To run all the migrations, invoke:

```bash
nx migrate --run-migrations=migrations.json
```

For small projects, running all the migrations at once often succeeds without any issues.

For large projects, more flexibility is often needed:

- You may have to skip a migration.
- You may want to run one migration at a time to address minor issues.
- You may want to reorder migrations.
- You may want to run the same migration multiple time if the process takes a long time and you had to rebase.

Since you can run `nx migrate --run-migrations=migrations.json` as many times as you want, you can achieve all of that by commenting out and reordering items in `migrations.json`.

The migrate process can take a long time, sometimes a day, so it can be useful to commit the migrations file.

### Overriding versions

Sometimes, you may want to use a different version of a package than what Nx recommends. You can do it as follows:

```bash
nx migrate @nrwl/workspace --to="jest@22.0.0,cypress:3.4.0"
```

By default, Nx uses currently installed packages to calculate what migrations need to run. You can override them like this:

```bash
nx migrate @nrwl/workspace --to="@nrwl/jest@8.0.0"
```

## Reverting a failed update

Updates are best done on a clean git history so that it can be easily reversed if something fails.
We try our best to make sure migrations do not fail but if one does, **please report it** on [Github](https://www.github.com/nrwl/nx/issues/new/).
If an update fails for any reason, you can revert it as you do any other set of changes:

```bash
git reset --hard # Reset any changes
git clean -fd # Delete newly added files and directories
```

## Updating Other Dependencies

Nx does not handle updating the dependencies that Nx did not add. Please refer to those projects for the best updating strategy.

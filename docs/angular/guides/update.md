# Updating Nx

Nx provides migrations which help you stay up to date with the latest version of Nx.
Not only do we migrate the version of Nx, but we also update the versions of dependencies which we install such as jest and cypress.
We recommend waiting for Nx to update these dependencies for you as we verify that these versions work together.

## How to Update

> **DO NOT** install the latest version of Nx via updating `package.json` or through `yarn`/`npm`.
> The migration process uses the currently installed version of Nx to decide which migrations must be run.
> Installing the latest version will result in no migrations to be run because it thinks there is nothing to be updated.

All you you have to do to update Nx to the latest version is run the following:

```bash
# For yarn
yarn update

# Or for npm
npm run update
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

Nx does not handle updating other dependencies such as `@angular/material` or others, that Nx did not add. Please refer to those projects for the best updating strategy.

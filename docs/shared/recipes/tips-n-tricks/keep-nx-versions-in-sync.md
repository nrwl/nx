# Keep Nx Versions in Sync

If your Nx plugin versions do not match the version of `nx` in your repository, you can encounter some difficult to debug errors. To get your Nx plugins back in sync, follow the steps below:

1. Identify all the official Nx plugins that are used in your repo. This includes `nx` and any packages in the `@nx/` or `@nrwl/` organization scope, except for plugins that are still in [nx-labs](https://github.com/nrwl/nx-labs). Also, `nx-cloud` does not need to match the other package versions.
2. Run `nx report` and identify the minimum and maximum version numbers for all the packages that need to by in sync.
3. Run `nx migrate --from=[minimumVersion] --to=[maximumVersion]`. Note that all the official Nx plugin migration generators are designed to be idempotent - meaning that running them multiple times is equivalent to running them once. This allows you to run the migrations for all plugins without being concerned about re-running a migration that was already run.

Review the [nx migrate](/features/automate-updating-dependencies) documentation for more options.

## Prevention

To ensure that the Nx plugin versions do not get out of sync, always run `nx migrate` when updating versions instead of manually updating modifying the `package.json` file.

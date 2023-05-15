# Automate Updating Dependencies

The Nx CLI provides the `migrate` command to help you stay up to date with the latest version of Nx.

Not only does `nx migrate` update you to the latest version of Nx, but it also updates the versions of dependencies that we support and test such as Jest and Cypress. You can also use the `migrate` command to update any Nx plugin.

## Update to the latest Nx version

Updating happens in three steps:

- The installed dependencies are updated including the `package.json` (and `node_modules`).
- The source code in the repo is updated to match the new versions of packages in `package.json`.
- Remove the `migrations.json` file

### Step 1: Updating dependencies and generating migrations

First, run the `migrate` command:

```shell
nx migrate latest # same as nx migrate nx@latest
```

You can also specify the name of the package and the version:

```shell
nx migrate nx@version # you can also specify version
```

This fetches the specified version of the `nx` package, analyzes the dependencies and fetches all the dependent packages. The process keeps going until all the dependencies are resolved. This results in:

- The `package.json` being updated
- A `migrations.json` being generated if there are pending migrations.

At this point, no packages have been installed, and no other files have been touched.

Now, you can inspect `package.json` to see if the changes make sense. Sometimes the migration can update a package to a version that is either not allowed or conflicts with another package. Feel free to manually apply the desired adjustments.

{% callout type="note" title="Inspect the changes" %}
At this stage, after inspecting the `package.json`, you may wish to manually run the appropriate install command for your workspace (e.g. `npm install`, `yarn`, or `pnpm install`) but in the next step `nx migrate --run-migrations` will also run this automatically for you.
{% /callout %}

### Step 2: Running migrations

The next step in the process involves using the `migrate` CLI in order to apply the migrations that were generated in `migrations.json` in the previous step.

Each Nx plugin is able to provide a set of migrations which are relevant to particular versions of the package, and so `migrations.json` will only contain migrations which are appropriate for the update you are currently applying.

The common case is that you will simply apply all migrations from the generated JSON file, exactly as they were generated in the previous step, by running:

```shell
nx migrate --run-migrations
```

This will update your source code in your workspace in accordance with the implementation of the various migrations which ran and all the changes will be unstaged ready for you to review and commit yourself.

### Step 3: Cleaning up

After you run all the migrations, you can remove `migrations.json` and commit any outstanding changes.

Note: You may want to keep the `migrations.json` until every branch that was created before the migration has been merged. Leaving the `migrations.json` in place allows devs to run `nx migrate --run-migrations` to apply the same migration process to their newly merged code as well.

## Problems?

If you can't run `nx migrate --run-migrations` all in one step, try the tips in [Advanced Update Process](/recipes/other/advanced-update)

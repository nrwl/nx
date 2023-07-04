# Automate Updating Dependencies

Keeping a codebase updated with the latest changes in your framework of choice and tooling can be challenging. Not to mention that "tooling maintenance work" is usually hard to squeeze into your feature sprint.

The `nx migrate` helps by automating the process of updating:

- package versions in your `package.json`
- configuration files (e.g. your Jest, ESLint or Nx config)
- your source code (e.g. fixing breaking changes or migrating to new best practices)

## How does it work?

Nx knows where its configuration files are and can therefore make sure they match the expected format or can alternatively adjust them. This automated update process, commonly referred to as "migration," becomes even more powerful when you leverage [Nx plugins](/packages). Nx plugins, which are NPM packages with a range of capabilities (code generation, task automation...), offer targeted updates based on their specific areas of responsibility.

For example, the [Nx ESLint plugin](/packages/linter) excels at configuring linting in your workspace. With its understanding of the configuration file locations, this plugin can provide precise migration scripts to update ESLint packages in your `package.json` and corresponding configuration files in your workspace when a new version is released.

Updating happens in three steps:

- The installed dependencies are updated including the `package.json` (and `node_modules`).
- The source code in the repo is updated to match the new versions of packages according to set of instructions specified in `migrations.json` file.
- Optionally remove the `migrations.json` file or keep it to re-run it in different Git branches

### Step 1: Updating dependencies and generating migrations

First, run the `migrate` command:

```shell
nx migrate latest # same as nx migrate nx@latest
```

Note you can also specify an exact version by replacing `latest` with `nx@<version>`.

This fetches the specified version of the `nx` package, analyzes the dependencies and fetches all the dependent packages. The process keeps going until all the dependencies are resolved. This results in:

- The `package.json` being updated
- A `migrations.json` being generated if there are pending migrations.

At this point, no packages have been installed, and no other files have been touched.

Now, you can inspect `package.json` to see if the changes make sense. Sometimes the migration can update a package to a version that is either not allowed or conflicts with another package. Feel free to manually apply the desired adjustments.

{% callout type="note" title="Inspect the changes" %}
At this stage, after inspecting the `package.json`, you may wish to manually run the appropriate install command for your workspace (e.g. `npm install`, `yarn`, or `pnpm install`) but in the next step `nx migrate --run-migrations` will also run this automatically for you.
{% /callout %}

### Step 2: Running migrations

You can now run the actual code migrations that were generated in the `migrations.json` in the previous step.

```shell
nx migrate --run-migrations
```

This will update your source code in your workspace in accordance with the implementation of the various migrations which ran and all the changes will be unstaged ready for you to review and commit yourself.

Note that each Nx plugin is able to provide a set of migrations which are relevant to particular versions of the package. Hence `migrations.json` will only contain migrations which are appropriate for the update you are currently applying.

### Step 3: Cleaning up

After you run all the migrations, you can remove `migrations.json` and commit any outstanding changes.

Note: You may want to keep the `migrations.json` until every branch that was created before the migration has been merged. Leaving the `migrations.json` in place allows devs to run `nx migrate --run-migrations` to apply the same migration process to their newly merged code as well.

## Need to opt-out of some migrations?

Sometimes you need to temporarily opt-out from some migrations because your workspace is not ready yet. You can manually adjust the `migrations.json` or run the update with the `--interactive` flag to choose which migrations you accept. Find more details in our [Advanced Update Process](/recipes/other/advanced-update) guide.

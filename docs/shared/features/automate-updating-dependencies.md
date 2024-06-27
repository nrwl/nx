# Automate Updating Dependencies

Keeping a codebase updated with the latest changes in your framework of choice can be challenging. Not to mention that "tooling maintenance work" is usually hard to squeeze into your feature sprint.

## nx migrate Makes Updating Simple

The `nx migrate` command helps by automating the process of updating:

- package versions in your `package.json`
- configuration files (e.g. your Jest, ESLint or Nx config)
- your source code (e.g. fixing breaking changes or migrating to new best practices)

## How Does It Work?

{% youtube
src="https://www.youtube.com/embed/Ss6MfcXi0jE"
title="How Automated Code Migrations Work"
/%}

Nx knows where its configuration files are and can therefore make sure they match the expected format. This automated update process, commonly referred to as "migration," becomes even more powerful when you leverage [Nx plugins](/nx-api). Nx plugins, which are NPM packages with a range of capabilities (code generation, task automation...), offer targeted updates based on their specific areas of responsibility.

For example, the [Nx ESLint plugin](/nx-api/eslint) excels at configuring linting in your workspace. With its understanding of the configuration file locations, this plugin can provide precise migration scripts to update ESLint packages in your `package.json` and corresponding configuration files in your workspace when a new version is released.

Updating happens in three steps:

- The installed dependencies are updated including the `package.json` (and `node_modules`).
- The source code in the repo is updated to match the new versions of packages according to the set of instructions specified in `migrations.json` file.
- Optionally remove the `migrations.json` file or keep it to re-run the migration in different Git branches

### Step 1: Update Dependencies and Generating Migrations

First, run the `migrate` command:

```shell
nx migrate latest # same as nx migrate nx@latest
```

Note you can also specify an exact version by replacing `latest` with `nx@<version>`.

{% callout title="Update One Major Version at a Time" %}
To avoid potential issues, it is [recommended to update one major version of Nx at a time](/recipes/tips-n-tricks/advanced-update#one-major-version-at-a-time-small-steps).
{% /callout %}

This fetches the specified version of the `nx` package, analyzes the dependencies and fetches all the dependent packages. The process keeps going until all the dependencies are resolved. This results in:

- The `package.json` being updated
- A `migrations.json` being generated if there are pending migrations.

{% callout type="note" title="Dependency Updates" %}
The migrations will update the `@nx/*` packages to the desired version. Subsequently, these packages _may_ also update other dependencies in your `package.json` to new versions if support has been added for them.
For example, migrating `@nx/react` to the latest version may also update the `react` version if support has been added for the latest version.
{% /callout %}

At this point, no packages have been installed, and no other files have been touched.

Now, you can inspect `package.json` to see if the changes make sense. Sometimes the migration can update a package to a version that is either not allowed or conflicts with another package. Feel free to manually apply the desired adjustments.

{% callout type="note" title="Inspect the changes" %}
At this stage, after inspecting the `package.json`, you may wish to manually run the appropriate install command for your workspace (e.g. `npm install`, `yarn`, or `pnpm install`) but in the next step `nx migrate --run-migrations` will also run this automatically for you.
{% /callout %}

### Step 2: Run Migrations

You can now run the actual code migrations that were generated in the `migrations.json` in the previous step.

```shell
nx migrate --run-migrations
```

This will update your source code in your workspace in accordance with the implementation of the various migrations which ran and all the changes will be unstaged ready for you to review and commit yourself.

Note that each Nx plugin is able to provide a set of migrations which are relevant to particular versions of the package. Hence `migrations.json` will only contain migrations which are appropriate for the update you are currently applying.

### Step 3: Clean Up

After you run all the migrations, you can remove `migrations.json` and commit any outstanding changes.

Note: You may want to keep the `migrations.json` until every branch that was created before the migration has been merged. Leaving the `migrations.json` in place allows devs to run `nx migrate --run-migrations` to apply the same migration process to their newly merged code as well.

## Keep Nx Packages on the Same Version

When you run `nx migrate`, the `nx` package and all the `@nx/` packages get updated to the same version. It is important to [keep these versions in sync](/recipes/tips-n-tricks/keep-nx-versions-in-sync), or you can encounter some difficult to debug errors. As long as you run `nx migrate` instead of manually changing the version numbers, you shouldn't have to worry about it. Also, when you add a new plugin, use `nx add <plugin>` to automatically install the version that matches your repository's version of Nx.

{% callout type="note" title="Use the latest nx-cloud version" %}
The `nx-cloud` package does not need to be in sync with the other Nx packages. For best results, stay on the latest version of `nx-cloud`. The latest `nx-cloud` version supports the most recent 2 major versions of `nx`, although earlier versions of `nx` may also be compatible.
{% /callout %}

## Migrate Community Plugins Individually

Community plugins should be migrated individually with:

```shell
nx migrate my-plugin
```

For a list of all the plugins you currently have installed, run:

```shell
nx report
```

## Need to Opt-out of Some Migrations?

Sometimes you need to temporarily opt-out from some migrations because your workspace is not ready yet. You can manually adjust the `migrations.json` or run the update with the `--interactive` flag to choose which migrations you accept. Find more details in our [Advanced Update Process](/recipes/tips-n-tricks/advanced-update) guide.

---
title: Automate Updating Dependencies
description: Learn how to use Nx migrate to automatically update package dependencies, configuration files, and source code to match new package versions.
keywords: [update, migrate]
---

# Automate Updating Dependencies

{% youtube
src="https://youtu.be/A0FjwsTlZ8A"
title="How Automated Code Migrations Work"
/%}

Keeping your tooling up to date is crucial for the health of your project. Tooling maintenance work can be tedious and time consuming, though. The **Nx migrate** functionality provides a way for you to

- automatically update your **`package.json` dependencies**
- migrate your **configuration files** (e.g. Jest, ESLint, Nx config)
- **adjust your source code** to match the new versions of packages (e.g., migrating across breaking changes)

To update your workspace, run:

```shell
npx nx migrate latest
```

{% callout type="note" title="Visual migration tool from Nx Console" %}
Want a more visual and guided way to migrate? Check out the [Migrate UI](/recipes/nx-console/console-migrate-ui) that comes with the [Nx Console extension](/getting-started/editor-setup).
{% /callout %}

## How Does It Work?

Nx knows where its configuration files are located and ensures they match the expected format. This automated update process, commonly referred to as "migration," becomes even **more powerful when you leverage [Nx plugins](/plugin-registry)**. Each plugin can provide migrations for its area of competency.

For example, the [Nx React plugin](/technologies/react/introduction) knows where to look for React and Nx specific configuration files and knows how to apply certain changes when updating to a given version of React.

In the example below, the React plugin defines a migration script (`./src/migrations/.../add-babel-core`) that runs when upgrading to Nx `16.7.0-beta.2` (or higher).

```json {% fileName="migrations.json" highlightLines=[6,7] %}
{
  "generators": {
    ...
    "add-babel-core": {
       ...
      "version": "16.7.0-beta.2",
      "implementation": "./src/migrations/update-16-7-0/add-babel-core"
    },
  },
}
```

When running `nx migrate latest`, Nx parses all the available plugins and their migration files and applies the necessary changes to your workspace.

## How Do I Upgrade My Nx Workspace?

Updating your Nx workspace happens in three steps:

1. The **installed dependencies**, including the `package.json` and `node_modules`, are updated.
2. Nx produces a `migrations.json` file containing the **migrations to be run** based on your workspace configuration. You can inspect and adjust the file. Run the migrations to update your configuration files and source code.
3. Optionally, you can remove the `migrations.json` file or keep it to re-run the migration in different Git branches.

You can intervene at each step and make adjustments as needed for your specific workspaces. This is especially important in large codebases where you might want to control the changes more granularly.

### Step 1: Update Dependencies and Generate Migrations

First, run the `migrate` command:

```shell
nx migrate latest
```

Note you can also specify an exact version by replacing `latest` with `nx@<version>`.

{% callout title="Update One Major Version at a Time" %}
To avoid potential issues, it is [recommended to update one major version of Nx at a time](/recipes/tips-n-tricks/advanced-update#one-major-version-at-a-time-small-steps).
{% /callout %}

This results in:

- The `package.json` being updated
- A `migrations.json` being generated if there are pending migrations.

At this point, no packages have been installed, and no other files have been touched.

Now, you can **inspect `package.json` to see if the changes make sense**. Sometimes the migration can update a package to a version that is either not allowed or conflicts with another package. Feel free to manually apply the desired adjustments. Also look at the `migrations.json` for the type of migrations that are going to be applied.

### Step 2: Run Migrations

You can now run the actual code migrations that were generated in the `migrations.json` in the previous step.

```shell
nx migrate --run-migrations
```

Depending on the migrations that ran, this might **update your source code** and **configuration files** in your workspace. All the changes will be unstaged ready for you to review and commit yourself.

{% callout type="info" title="Migrations are version specific" %}
Note that each Nx plugin is able to provide a set of migrations which are relevant to particular versions of the package. Hence `migrations.json` will only contain migrations which are appropriate for the update you are currently applying.
{% /callout %}

### Step 3: Clean Up

After you run all the migrations, you can remove `migrations.json` and commit any outstanding changes.

Note: You may want to keep the `migrations.json` until every branch that was created before the migration has been merged. Leaving the `migrations.json` in place allows devs to run `nx migrate --run-migrations` to apply the same migration process to their newly merged code as well.

### Step 4: Update Community Plugins (Optional)

If you have any [Nx community plugins](/plugin-registry) installed you need to migrate them individually (assuming they provide migration scripts) by using the following command:

```shell
nx migrate my-plugin
```

For a list of all the plugins you currently have installed, run:

```shell
nx report
```

## Keep Nx Packages on the Same Version

When you run `nx migrate`, the `nx` package and all the `@nx/` packages get updated to the same version. It is important to [keep these versions in sync](/recipes/tips-n-tricks/keep-nx-versions-in-sync) to have Nx work properly.

As long as you run `nx migrate` instead of manually changing the version numbers, you shouldn't have to worry about it. Also, when you add a new plugin, use `nx add <plugin>` to automatically install the version that matches your repository's version of Nx.

## Need to Opt-out of Some Migrations?

Sometimes you need to temporarily opt-out from some migrations because your workspace is not ready yet. You can manually adjust the `migrations.json` or run the update with the `--interactive` flag to choose which migrations you accept.

Find more details in our [Advanced Update Process](/recipes/tips-n-tricks/advanced-update) guide.

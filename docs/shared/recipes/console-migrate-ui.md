---
title: Nx Console Migrate UI
description: Learn how to use the Nx Console Migrate UI to interactively update package dependencies, configuration files, and source code to match new package versions.
---

# Nx Console Migrate UI

The Nx Console Migrate UI provides a visual, guided way to apply migrations in your Nx workspace. This tool simplifies the process of updating your workspace by offering an easy-to-use interface that walks you through each step of the migration process.

## Starting the Migration

The Migrate UI is available for VSCode and Cursor editors. Make sure you have the [Nx Console extension](/getting-started/editor-setup) installed before you continue.

When an update to Nx is available, a badge will appear on the Nx Console icon in your Activity Bar. Bring up the Nx Console view (Hint: type in `> Show Nx Console` in the Command Palette), and you'll see a `Nx Migrate` section in the sidebar. Clicking `Start Migration` starts the migration process.

![](/shared/images/nx-console/console-migrate-1-start.avif)

By default, clicking the migration button starts the migration process by upgrading to the recommended Nx version — the latest version of the next major release. This method ensures you upgrade one major version at a time in order to [avoid breakages](recipes/tips-n-tricks/advanced-update#one-major-version-at-a-time-small-steps). To customize the version, click the pencil icon to provide a specific version to update to. You may also provide additional CLI options such as `--to` or `--from`.

![](/shared/images/nx-console/console-migrate-2-customize-version.avif)

{% callout type="note" title="Ensure clean git status" %}
If you have uncommitted changes, stash or commit them before initiating a migration. Otherwise, the migration button will be disabled.
{% /callout %}

Once you start the migration, Nx Console runs the `nx migrate` command to update your dependency versions and generate a `migrations.json` file. You'll be prompted to inspect the changes made to your `package.json` before installing them and proceeding.

![](/shared/images/nx-console/console-migrate-3-confirm.avif)

## The Migration Process

After confirming the `package.json` changes, the Migrate UI opens and guides you step-by-step through each migration action. Each migration will be executed in the order as they appear in `migration.json`. If a migration results in file changes, you will be prompted to review the changes before continuing. You can either `Accept` or `Undo` the migration.

![](/shared/images/nx-console/console-migrate-4-approve.avif)

If a migration step encounters an error, the process pauses so you can inspect the error details.

![](/shared/images/nx-console/console-migrate-5-error.avif)

You can click through to view the migration source code, giving you the opportunity to patch it for your specific use-case or make necessary adjustments to your repository before rerunning the migration.

Alternatively, you may choose to skip a problematic migration.

## Finalizing the Migration

When all migrations are done, or you don't want to run further migrations, you can finish the process by clicking the Finish button. By default, this will squash all commits created during the migration together, but you can opt into preserving them.

You will be prompted for the git commit message, once you enter it the `migrations.json` file is removed and the migration process is finished.

![](/shared/images/nx-console/console-migrate-6-finish.avif)

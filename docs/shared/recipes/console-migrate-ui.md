---
title: 'Nx Console Migrate UI'
description: Overview over the Migrate UI feature for guided migrations in Nx Console
---

# Nx Console Migrate UI

The Nx Console Migrate UI provides a visual, guided way to execute migrations in your workspace while following Nx best practices. This tool simplifies the process of upgrading your Nx workspace by offering an easy-to-use interface that walks you through each step of the migration process.

## Accessing the Migrate UI

The Migrate UI is available on the latest version of Nx Console in VSCode or Cursor if you have enabled the `nxConsole.enableMigrateUi` setting. If enabled, a dedicated `Nx Migrate` view will appear in the sidebar. Unless you're on the latest version of Nx, you'll notice a button prompting you to start the migration.

{% callout type="note" %}
Ensure you have stashed or committed all your changes before initiating a migration.
{% /callout %}

## Starting a Migration

By default, clicking the migration button starts the migration process by upgrading to the recommended Nx version — the latest version of the next major release. This method ensures you upgrade one major version at a time in order to [avoid breakages](recipes/tips-n-tricks/advanced-update#one-major-version-at-a-time-small-steps)

{%callout type="note"%}
If you need more control, a smaller edit button is provided. You can use it to customize the migration process by specifying an exact version and passing custom CLI options like `--to` or `--from`.
{% /callout %}

Once you start the migration, Nx Console runs the `nx migrate` command to update your dependency versions and generate a `migrations.json` file. You'll be prompted to inspect the changes made to your `package.json` before installing them and proceedig.

## The Migration Process

After confirming the changes, the Migrate UI opens and guides you step-by-step through each migration action. Simply click on `Run Migrations` and each migration will be executed in order.

If a migration step encounters an error, the process pauses so you can inspect the error details.
You can click through to view the migration source code, giving you the opportunity to patch it for your specific use-case or make necessary adjustments to your repository before rerunning the migration.
Alternatively, you may choose to skip a problematic migration.

For successful migration steps that modify files, the UI pauses to let you review the changes. You must approve these changes before the migration continues.

## Finalizing the Migration

When all migration steps are complete or you don't want to run further migrations, you can finish the process by clicking the Finish button. By default, this will squash all commits created during the migration together, but you can opt into preserving them.

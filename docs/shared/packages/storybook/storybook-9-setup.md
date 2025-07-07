---
title: Storybook 9 overview
description: This guide explains how you can set up Storybook version 9 in your Nx workspace. It also highlights the changes that you should expect to see when migrating from Storybook 8 to Storybook 9.
---

# Storybook 9 is here - and Nx is ready

Storybook 9 is a major release that brings a lot of new features and improvements. You can read more about it in the [Storybook 9.0.0 release article](https://storybook.js.org/blog/storybook-9/). Apart from the new features and improvements it introduces, it also brings some breaking changes. You can read more about them in the [Storybook 9 migration docs](https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#from-version-8x-to-900) and the [Storybook 9.0.0 migration guide](https://storybook.js.org/docs/react/migration-guide).

Nx provides new generators that allow you to generate Storybook 9 configuration for your projects, by installing the correct dependencies and creating the corresponding version 7 configuration files. Nx also provides a [Storybook 9 migration generator](/technologies/test-tools/storybook/api/generators/migrate-9) that you can use to migrate your existing Storybook configuration to version 9.

So, let's see how you can use Storybook 9 on your Nx workspace.

## Migrate your existing workspace to Storybook 9

If you already have Storybook configured in your Nx workspace, you can use the [Storybook 9 migrator generator](/technologies/test-tools/storybook/api/generators/migrate-9) to migrate your existing Storybook configuration to version 9.

## Set up Storybook 9 in a _new_ Nx Workspace

Please read the [`@nx/storybook` package overview](/technologies/test-tools/storybook) to see how you can configure Storybook in your Nx workspace.

## Report any issues and bugs

Please report any issues and bugs you find [on the Nx GitHub page](https://github.com/nrwl/nx/issues/new/choose) or on the [Storybook GitHub page](https://github.com/storybookjs/storybook/issues/new/choose).

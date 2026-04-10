---
title: Upgrading Storybook using the Storybook CLI
description: This guide explains how you can upgrade Storybook using the Storybook CLI upgrade and automigrate commands.
---

# Upgrading Storybook using the Storybook CLI

In a Nx workspace, managing and upgrading Storybook instances across various projects can be streamlined using the Storybook CLI's `upgrade` and `automigrate` commands. This guide will walk you through how to use these commands within a Nx workspace, particularly focusing on the use of the `--config-dir` flag which will guide the Storybook CLI on where to find the projects in your workspace that use Storybook and need to be automigrated. You can read more about how to upgrade Storybook in the [Upgrade Storybook documentation](https://storybook.js.org/docs/configure/upgrading).

## When should you use the Storybook CLI to upgrade?

Nx offers migration generators to help you upgrade your Nx workspace and your projects to the latest version of Nx, and of the tools Nx uses. One of these tools is, of course, Storybook, and Nx offers migration generators to help you upgrade your Storybook setup as well. However, the Storybook CLI provides a more comprehensive set of commands and generators (_"automigrations"_ as they are called in their context) to help you upgrade your Storybook setup. It can be used in conjunction with the Nx migration generators to ensure your Storybook setup is up-to-date with the latest Storybook features and best practices.

So, you should prefer to use the Storybook CLI to upgrade your Storybook setup in the following cases:

- When you want to try out a new version of Storybook, for example the `next` version, for which Nx might not have a migration generator yet.

- When Nx does not already have a migrator for a specific Storybook version in place. Nx will in most cases take care of migrations that are specific to Nx, but the Storybook CLI automigrations are more comprehensive.

It's worth noting that whenever Nx adds a migration generator to move from one major Storybook version to the next, Nx still calls the Storybook CLI migration commands under the hood.

We have worked together with the Storybook team to ensure that the Storybook CLI accepts the `--config-dir` flag, which is used in order to let the Storybook CLI know where to look for Storybook projects, since the migration scripts that Storybook offers depend on the presence of a `.storybook/main.*` file, which will determine a project.

So, if you want to try out a new version of Storybook, these two commands are the best way to do it.

## Using the Storybook CLI in Nx

The Storybook CLI provides the `upgrade` and `automigrate` commands to help you update your Storybook setup and apply modifications to your files automatically, ensuring your configuration and code (stories, etc) are up-to-date with the version of Storybook you are targeting.

## Upgrading Storybook

To upgrade Storybook to the latest version in your Nx workspace, you can use the `npx storybook upgrade` command. This command will apply any necessary updates to the Storybook dependencies in your workspace's `package.json`.

So, navigate to your Nx workspace root and run the following command:

```bash
npx storybook@latest upgrade
```

You can replace `@latest` with `@next` or with any specific Storybook version you want to upgrade to.

### What about the `--config-dir` flag?

The `upgrade` command will update the Storybook dependencies in your `package.json`, and then it will look for a `.storybook/main.*` file at the root of your workspace, to determine what other changes need to happen (any package-specific updates), and it will also call the `automigrate` command, which will attempt to apply any necessary code modifications to your Storybook configuration files and your stories.

If you use the `npx storybook upgrade` command without providing a `--config-dir` flag, then Storybook will upgrade your dependencies, but it will tell you that it found no projects to automigrate, since your `.storybook/main.*` files are (most probably) not at the root of your workspace. It will also prompt you to use the `--config-dir` flag to tell Storybook where to look for your Storybook projects.

So, you can modify the above command to include the `--config-dir` flag, like so:

```bash
npx storybook@latest upgrade --config-dir apps/my-app/.storybook
```

Then, you would have to call that command for each of your Storybook projects in your workspace. Since your dependencies should already be updated, you can call the `automigrate` command directly, instead.

## Automigrating Storybook Configuration

The `automigrate` command allows you to automatically apply code modifications to your Storybook configuration files and your stories, ensuring they're aligned with the latest Storybook standards.

To use `automigrate` in your Nx project, execute the following command, substituting `apps/my-app/.storybook` with your actual configuration path:

```bash
npx storybook automigrate --config-dir apps/my-app/.storybook
```

This will run the automigration scripts and code modifications on your Storybook setup, upgrading configuration files and potentially some story syntax to align with the latest Storybook version's expectations. Again, you would have to call that command for each of your Storybook projects in your workspace.

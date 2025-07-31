---
title: Installation
description: Install Nx globally via npm, Homebrew, Chocolatey, or apt. Add Nx to existing repos with nx init and keep dependencies updated automatically.
---

# Installation

To install Nx CLI on your machine, choose one of the following methods based on your operating system and package manager. You can also use `npx` to run the Nx CLI without installing it globally.

{% tabs %}
{% tab label="npm" %}

```shell
npm add --global nx
```

**Note:** You can also use yarn, pnpm, or bun

{% /tab %}
{% tab label="Homebrew (macOS, Linux)" %}

```shell
brew install nx
```

{% /tab %}
{% tab label="Chocolatey (Windows)" %}

```shell
choco install nx
```

{% /tab %}
{% tab label="apt (Ubuntu)" %}

```shell
sudo add-apt-repository ppa:nrwl/nx
sudo apt update
sudo apt install nx
```

{% /tab %}
{% /tabs %}

## Adding Nx to Your Repository

To add Nx to an existing repository, run:

```shell
nx init
```

**Note:** You can also manually install the nx NPM package and create a [nx.json](/reference/nx-json) to configure it. Learn more about [adopting Nx in an existing project](/recipes/adopting-nx)

### Starter Repository

To create a starter repository, you can use the `create-nx-workspace` command. This will create a new Nx workspace with a default configuration and example applications.

```shell
npx create-nx-workspace@latest
```

## Update Nx

When you update Nx, Nx will also [automatically update your dependencies](/features/automate-updating-dependencies) if you have an [Nx plugin](/concepts/nx-plugins) installed for that dependency. To update Nx, run:

```shell
nx migrate latest
```

This will create a `migrations.json` file with any update scripts that need to be run. Run them with:

```shell
nx migrate --run-migrations
```

{% callout title="Update One Major Version at a Time" %}
To avoid potential issues, it is [recommended to update one major version of Nx at a time](/recipes/tips-n-tricks/advanced-update#one-major-version-at-a-time-small-steps).
{% /callout %}

## Tutorials

Try one of these tutorials for a full walkthrough of what to do after you install Nx:

- [TypeScript Monorepo Tutorial](/getting-started/tutorials/typescript-packages-tutorial)
- [React Monorepo Tutorial](/getting-started/tutorials/react-monorepo-tutorial)
- [Angular Monorepo Tutorial](/getting-started/tutorials/angular-monorepo-tutorial)

## More Documentation

- [Add Nx to an Existing Repository](/recipes/adopting-nx)
- [Update Nx](/features/automate-updating-dependencies)
- [Update Your Global Nx Installation](/recipes/installation/update-global-installation)
- [Install Nx in a Non-Javascript Repo](/recipes/installation/install-non-javascript)

---
title: Overview of the Nx Vue Plugin
description: The Nx Plugin for Vue contains generators for managing Vue applications and libraries within an Nx workspace. This page also explains how to configure Vue on your Nx workspace.
---

The Nx plugin for [Vue](https://vuejs.org/).

## Setting Up @nx/vue

### Generating a new Workspace

To create a new workspace with React, run `npx create-nx-workspace@latest --preset=vue`.

{% callout type="note" title="Vue Standalone Tutorial" %}
For a full tutorial experience, follow the [Vue Standalone Tutorial](/getting-started/tutorials/vue-standalone-tutorial)
{% /callout %}

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/vue` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/vue` by running the following command:

{% tabs %}
{% tab label="Nx 18+" %}

```shell {% skipRescope=true %}
nx add @nx/vue
```

This will install the correct version of `@nx/vue`.

{% /tab %}
{% tab label="Nx < 18" %}

Install the `@nx/vue` package with your package manager.

```shell {% skipRescope=true %}
npm add -D @nx/vue
```

{% /tab %}
{% /tabs %}

## Using the @nx/vue Plugin

### Generate a new project using Vue

To generate a Vue application, run the following:

```shell
nx g @nx/vue:app my-app
```

To generate a Vue library, run the following:

```shell
nx g @nx/vue:lib my-lib
```

## More Documentation

- [Vue Standalone Tutorial](/getting-started/tutorials/vue-standalone-tutorial)

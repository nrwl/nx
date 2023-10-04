---
title: Overview of the Nx Vue Plugin
description: The Nx Plugin for Vue contains generators for managing Vue applications and libraries within an Nx workspace. This page also explains how to configure Vue on your Nx workspace.
---

The Nx plugin for [Vue](https://vuejs.org/).

## Setting up a new Nx workspace with Vue

You can create a new workspace that uses Vue with one of the following commands:

- Generate a new monorepo with a Vue app set up with Vue

```shell
npx create-nx-workspace@latest --preset=vue
```

## Add Vue to an existing workspace

There are a number of ways to use Vue in your existing workspace.

### Install the `@nx/vue` plugin

{% tabs %}
{% tab label="npm" %}

```shell
npm install -D @nx/vue
```

{% /tab %}
{% tab label="yarn" %}

```shell
yarn add -D @nx/vue
```

{% /tab %}
{% tab label="pnpm" %}

```shell
pnpm install -D @nx/vue
```

{% /tab %}
{% /tabs %}

### Generate a new project using Vue

To generate a Vue application, run the following:

```bash
nx g @nx/vue:app my-app
```

To generate a Vue library, run the following:

```bash
nx g @nx/vue:lib my-lib
```

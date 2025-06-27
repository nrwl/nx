---
title: Set up Storybook for Vue and Nuxt Projects
description: This guide explains how to set up Storybook for Vue and Nuxt projects in your Nx workspace.
---

# Set up Storybook for Vue and Nuxt Projects

This guide will walk you through setting up [Storybook](https://storybook.js.org) for Vue and Nuxt projects in your Nx workspace.

{% callout type="warning" title="Set up Storybook in your workspace" %}
You first need to set up Storybook for your Nx workspace, if you haven't already. You can read the [Storybook plugin overview guide](/technologies/test-tools/storybook/introduction) to get started.
{% /callout %}

## Generate Storybook Configuration for a Vue or Nuxt project

You can generate Storybook configuration for an individual Vue or Nuxt project by using the [`@nx/vue:storybook-configuration` generator](/technologies/vue/api/generators/storybook-configuration), like this:

{% tabs %}
{% tab label="Vue" %}

```shell
nx g @nx/vue:storybook-configuration project-name
```

{% /tab %}
{% tab label="Nuxt" %}

```shell
nx g @nx/nuxt:storybook-configuration my-nuxt-app
```

{% /tab %}

{% /tabs %}

## Auto-generate Stories

The [`@nx/vue:storybook-configuration` generator](/technologies/vue/api/generators/storybook-configuration) has the option to automatically generate `*.stories.ts` files for each component declared in the library.

```text
<some-folder>/
├── MyComponent.vue
└── MyComponent.stories.ts
```

If you add more components to your project, and want to generate stories for all your (new) components at any point, you can use the [`@nx/vue:stories` generator](/technologies/vue/api/generators/stories):

{% tabs %}
{% tab label="Vue" %}

```shell
nx g @nx/vue:stories --project=<project-name>
```

{% /tab %}
{% tab label="Nuxt" %}

```shell
nx g @nx/nuxt:stories --project=<project-name>
```

{% /tab %}

{% /tabs %}

{% callout type="note" title="Example" %}
Let's take for a example a library in your workspace, under `libs/feature/ui`, called `feature-ui`. This library contains a component, called `my-button`.

The command to generate stories for that library would be:

```shell
nx g @nx/vue:stories --project=feature-ui
```

and the result would be the following:

```text
<workspace name>/
├── apps/
├── libs/
│   ├── feature/
│   │   ├── ui/
|   |   |   ├── .storybook/
|   |   |   ├── src/
|   |   |   |   ├──lib
|   |   |   |   |   ├──my-button
|   |   |   |   |   |   ├── MyButton.vue
|   |   |   |   |   |   ├── MyButton.stories.ts
|   |   |   |   |   |   └── etc...
|   |   |   |   |   └── etc...
|   |   |   ├── README.md
|   |   |   ├── tsconfig.json
|   |   |   └── etc...
|   |   └── etc...
|   └── etc...
├── nx.json
├── package.json
├── README.md
└── etc...
```

{% /callout %}

## More Documentation

You can find all Storybook-related Nx topics [here](/technologies/test-tools/storybook/introduction).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/vue/get-started/introduction).

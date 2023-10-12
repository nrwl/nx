---
title: Set up Storybook for Nuxt Projects
description: This guide explains how to set up Storybook for Nuxt projects in your Nx workspace.
---

# Set up Storybook for Nuxt Projects

This guide will walk you through setting up [Storybook](https://storybook.js.org) for Nuxt projects in your Nx workspace.

The generators for your Nuxt projects use the `@nx/vue:storybook-configuration` and `@nx/vue:stories` generators under the hood, with some additional configuration. There is no official support or settings for Nuxt3 in Storybook yet, so until then we are just configuring your Nuxt apps as if they were Vue apps, since the components are still Vue components.

{% callout type="warning" title="Set up Storybook in your workspace" %}
You first need to set up Storybook for your Nx workspace, if you haven't already. You can read the [Storybook plugin overview guide](/nx-api/storybook) to get started.
{% /callout %}

## Generate Storybook Configuration for a Nuxt project

You can generate Storybook configuration for an individual Nuxt project by using the [`@nx/nuxt:storybook-configuration` generator](/nx-api/nuxt/generators/storybook-configuration), like this:

```shell
nx g @nx/nuxt:storybook-configuration project-name
```

## Auto-generate Stories

The [`@nx/nuxt:storybook-configuration` generator](/nx-api/nuxt/generators/storybook-configuration) has the option to automatically generate `*.stories.ts` files for each component declared in your project, under the `components` directory. This makes sure that no stories are generated for your `pages` components. The stories will be generated using [Component Story Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/).

```text
<some-folder>/
├── MyComponent.vue
└── MyComponent.stories.ts
```

If you add more components to your project, and want to generate stories for all your (new) components at any point, you can use the [`@nx/nuxt:stories` generator](/nx-api/nuxt/generators/stories):

```shell
nx g @nx/nuxt:stories --project=<project-name>
```

{% callout type="note" title="Example" %}
Let's take for a example a Nuxt application in your workspace, under `my-nuxt-app`, called `my-nuxt-app`. This application contains a component, called `my-button`.

The command to generate stories for that application would be:

```shell
nx g @nx/nuxt:stories --project=my-nuxt-app
```

and the result would be the following:

```text
<workspace name>/
my-nuxt-app
├── nuxt.config.ts
├── project.json
├── src
│   ├── app.vue
│   ├── assets
│   ├── components
│   │   └── my-button
│   │       ├── my-button.stories.ts
│   │       └── my-button.vue
│   ├── pages
│   ├── public
│   └── server
├── tsconfig.json
└── tsconfig.storybook.json
```

{% /callout %}

## More Documentation

You can find all Storybook-related Nx topics [here](/nx-api#storybook).

For more on using Storybook, see the [official Storybook documentation](https://storybook.js.org/docs/vue/get-started/introduction).

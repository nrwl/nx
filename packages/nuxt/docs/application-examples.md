---
title: Nuxt application generator examples
description: This page contains examples for the @nx/nuxt:app generator.
---

Your new Nuxt application will be generated with the following directory structure, following the suggested [directory structure](https://nuxt.com/docs/guide/directory-structure) for Nuxt applications:

```text
my-nuxt-app
├── nuxt.config.ts
├── project.json
├── src
│   ├── app.vue
│   ├── assets
│   │   └── css
│   │       └── styles.css
│   ├── components
│   │   └── NxWelcome.vue
│   ├── pages
│   │   ├── about.vue
│   │   └── index.vue
│   ├── public
│   │   └── favicon.ico
│   └── server
│       ├── api
│       │   └── greet.ts
│       └── tsconfig.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.spec.json
└── vitest.config.ts
```

Your new app will contain the following:

- Two pages (home and about) under `pages`
- A component (`NxWelcome`) under `components`
- A `greet` API endpoint that returns a JSON response under `/api/greet`
- Configuration for `vitest`
- Your app's entrypoint (`app.vue`) will contain the navigation links to the home and about pages, and the `nuxt-page` component to display the contents of your pages.

## Examples

{% tabs %}
{% tab label="Create app in a directory" %}

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, use `--directory=nested`. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

```shell
nx g @nx/nuxt:app =apps/nested/myapp
```

{% /tab %}

{% tab label="Create app with vitest configured" %}

```shell
nx g @nx/nuxt:app apps/nested/myapp --unitTestRunner=vitest
```

{% /tab %}

{% tab label="Use plain JavaScript (not TypeScript)" %}

```shell
nx g @nx/nuxt:app apps/myapp --js
```

{% /tab %}
{% /tabs %}

## Generate pages and components

You can use the the [`@nx/vue:component` generator](/nx-api/vue/generators/component) to generate new pages and components for your application. You can read more on the [`@nx/vue:component` generator documentation page](/nx-api/vue/generators/component), but here are some examples:

{% tabs %}
{% tab label="New page" %}

```shell
nx g @nx/nuxt:component my-app/src/pages/my-page
```

{% /tab %}

{% tab label="New component" %}

```shell
nx g @nx/nuxt:component my-app/src/components/my-cmp
```

{% /tab %}
{% /tabs %}

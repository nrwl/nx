---
title: Vue and Nuxt component generator examples
description: This page contains examples for the @nx/vue:component generator.
---

This generator will help you generate components for your Vue or your Nuxt projects.

## Examples

### Create a new component for your Vue app

```shell
nx g @nx/vue:component --directory=my-app/src/app/my-cmp --name=my-cmp
```

### Create a new component for your Nuxt app

As recommended in the [Nuxt documentation](https://nuxt.com/docs/guide/directory-structure/components), place your components into the `components` directory of your app. Nuxt automatically imports any components in this
directory.

Running the following will create a new component in the `my-app/src/components` directory:

```shell
nx g @nx/nuxt:component --directory=my-app/src/components/my-cmp --name=my-cmp
```

### Create a new page for your Nuxt app

As stated in the [Nuxt documentation](https://nuxt.com/docs/guide/directory-structure/pages), Nuxt provides _a file-based routing to create routes within your web application_. Place your pages into the `pages` directory of your app.

Running the following will create a new component (page) in the `my-app/src/pages` directory:

```shell
nx g @nx/nuxt:component --directory=my-app/src/pages --name=my-page
```

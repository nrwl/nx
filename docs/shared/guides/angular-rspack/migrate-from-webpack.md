---
title: 'Migrate Angular with Webpack to Rspack'
description: 'Guide on how to Migrate Angular projects using Webpack to Rspack'
---

# Migrate Angular with Webpack to Rspack

Until recently, Angular used Webpack to build applications. Based on this, some third-party builders emerged to allow users to use a custom Webpack configuration when building their Angular applications.
When Angular switched to Esbuild, this meant that it became difficult for applications that used custom Webpack configurations to migrate to the new build system. This guide will help you migrate from Angular with Webpack to Rspack.
By migrating to Rspack, you can gain an immediate build performance benefit while maintaining the your existing Webpack build toolchain.

## Step 1: Initialize Nx

{% callout type="warning" title="Optional Step" %}
If you are already using Nx with version 20.6.0 or greater, you can skip this step.
{% /callout %}

Nx provides a generator to convert existing Angular Webpack projects to use `@nx/angular-rspack`. This generator is currently available in Nx `20.6.0`.

At the root of your project, run the following command:

```bash
npx nx@latest init
```

## Step 2: Run the Convert to Rspack Generator

With Nx now initialized, the `@nx/angular` plugin will have been installed providing access to a series of generators and executors that aid Angular development.
In particular, the `@nx/angular:convert-to-rspack` generator will convert an Angular project to use Rspack.
To use it, run the following command:

```bash
npx nx g convert-to-rspack
```

## Step 3: Run your application

After running the generator, you can run tasks such as `build` and `serve` to build and serve your application.

```bash
npx nx build yourProjectName
npx nx serve yourProjectName
```

---
title: Overview of the Nx Angular Plugin
description: The Nx Plugin for Angular contains executors, generators, and utilities for managing Angular applications and libraries within an Nx workspace.
keywords: [angular]
---

# @nx/angular

The Nx Plugin for Angular contains executors, generators, and utilities for managing Angular applications and libraries
within an Nx workspace. It also enables using Angular Devkit builders and schematics in Nx workspaces.

Among other things, it provides:

- Integration with libraries such as:
  - Cypress
  - ESLint
  - Jest
  - Playwright
  - Storybook
- Generators to help scaffold code quickly, including:
  - Micro Frontends
  - Libraries, both internal to your codebase and publishable to npm
  - Projects with Tailwind CSS
- Executors providing extra capabilities on top of the Angular Devkit builders:
  - Provide ESBuild plugins
  - Provide custom webpack configurations
- Utilities for automatic workspace refactoring

{% callout type="note" title="Currently using the Angular CLI?" %}
You can easily and mostly **automatically migrate from an Angular CLI** project to Nx! Learn
more [here](technologies/angular/migration/angular).
{% /callout %}

## Setting Up @nx/angular

### Installation

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/angular` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

In any Nx workspace, you can install `@nx/angular` by running the following command:

```shell {% skipRescope=true %}
nx add @nx/angular
```

This will install the correct version of `@nx/angular`.

{% callout type="note" title="Angular Tutorial" %}
For a full tutorial experience, follow the [Angular Monorepo Tutorial](/getting-started/tutorials/angular-monorepo-tutorial)
{% /callout %}

## Using the Angular Plugin

### Generating an application

It's straightforward to generate an Angular application:

```shell
nx g @nx/angular:app apps/appName
```

By default, the application will be generated with:

- ESLint as the linter.
- Jest as the unit test runner.
- Cypress as the E2E test runner.

We can then serve, build, test, lint, and run e2e tests on the application with the following commands:

```shell
nx serve appName
nx build appName
nx test appName
nx lint appName
nx e2e appName
```

### Generating a library

Generating an Angular library is very similar to generating an application:

```shell
nx g @nx/angular:lib libs/libName
```

By default, the library will be generated with:

- ESLint as the linter.
- Jest as the unit test runner.

We can then test and lint the library with the following commands:

```shell
nx test libName
nx lint libName
```

Read more about:

- [Creating Libraries](/concepts/decisions/project-size)
- [Library Types](/concepts/decisions/project-dependency-rules)
- [Buildable and Publishable Libraries](/concepts/buildable-and-publishable-libraries)

### Fallback to `@schematics/angular`

If you try to invoke a generator that is not present in `@nx/angular`, the request will automatically be forwarded on
to `@schematics/angular`. So, even though there is no `@nx/angular:service` generator, the following command will
successfully create a service:

```shell
nx g @nx/angular:service apps/appName/src/lib/my-service/my-service
```

## More Documentation

- [Angular Monorepo Tutorial](/getting-started/tutorials/angular-monorepo-tutorial)
- [Migrating from the Angular CLI](technologies/angular/migration/angular)
- [Setup Module Federation with Angular and Nx](/technologies/module-federation/concepts/faster-builds-with-module-federation)
- [Using Tailwind CSS with Angular projects](/technologies/angular/recipes/using-tailwind-css-with-angular-projects)

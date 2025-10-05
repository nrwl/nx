---
title: 'Getting Started - Angular Rspack'
description: 'Learn how to get started with Angular Rspack applications in Nx.'
---

# Getting Started

This guide will walk you through setting up a new Angular Rspack application in Nx. By the end of this guide, you will have a new Angular application with Rspack configured.

There are two paths you can follow to get started with Angular Rspack in Nx:

1. Create a new Nx Workspace with preconfigured Angular Rspack application
2. Add an existing Angular Rspack application to an Nx Workspace

## Create a new Nx Workspace with preconfigured Angular Rspack application

To create a new Nx Workspace with a preconfigured Angular Rspack application, run the following command:

{% tabs %}
{% tab label="Client-Side Rendering (CSR)" %}

```{% command="npx create-nx-workspace myorg" path="~/" %} {% highlightLines=[7,9] %}

NX   Let's create a new workspace [[https://nx.dev/getting-started/intro](https://nx.dev/getting-started/intro)]

✔ Which stack do you want to use? · angular
✔ Integrated monorepo, or standalone project? · integrated
✔ Application name · myorg
✔ Which bundler would you like to use? · rspack
✔ Default stylesheet format · css
✔ Do you want to enable Server-Side Rendering (SSR)? · No
✔ Which unit test runner would you like to use? · vitest
✔ Test runner to use for end to end (E2E) tests · playwright

NX   Creating your v20.8.0 workspace.

```

{%/tab %}
{% tab label="Server-Side Rendering (SSR)" %}

```{% command="npx create-nx-workspace myorg" path="~/" %} {% highlightLines=[7,9] %}

NX   Let's create a new workspace [[https://nx.dev/getting-started/intro](https://nx.dev/getting-started/intro)]

✔ Which stack do you want to use? · angular
✔ Integrated monorepo, or standalone project? · integrated
✔ Application name · myorg
✔ Which bundler would you like to use? · rspack
✔ Default stylesheet format · css
✔ Do you want to enable Server-Side Rendering (SSR)? · Yes
✔ Which unit test runner would you like to use? · vitest
✔ Test runner to use for end to end (E2E) tests · playwright

NX   Creating your v20.8.0 workspace.

```

{% /tab %}
{% /tabs %}

This command will create a new Nx Workspace with an Angular Rspack application in the `myorg` directory.

## Add an existing Angular Rspack application to an Nx Workspace

To add an existing Angular Rspack application to an Nx Workspace, run the following command:

{% callout type="info" title="Minimum Nx Version" %}

The minimum Nx version required to add an Angular Rspack application to an Nx Workspace is `20.6.1`.
If you are using an older version of Nx, run `npx nx migrate` to migrate your workspace to the latest version.

You can learn more about Nx migrations [here](/features/automate-updating-dependencies).

{% /callout %}

{% tabs %}
{% tab label="Client-Side Rendering (CSR)" %}

```bash
npx nx g @nx/angular:app myapp --bundler=rspack
```

{% /tab %}
{% tab label="Server-Side Rendering (SSR)" %}

```bash
npx nx g @nx/angular:app myapp --bundler=rspack --ssr
```

{% /tab %}
{% /tabs %}

This command will add an Angular Rspack application to the `myapp` directory.

## Working with the Angular Rspack application

After generating the application, you will notice the following:

- A `rspack.config.ts` file in the root of the project
- The `project.json` file does not have a `targets.build` or `targets.serve` target

The `rspack.config.ts` file is a configuration file for Rspack. It contains the configuration options for Rspack and for Angular Rspack a helper [createConfig](/technologies/angular/angular-rspack/api/create-config)
function is used to map the options you would expect to set in the `project.json` or `angular.json` files to the Rspack configuration.

The `project.json` file does not contain the `targets.build` or `targets.serve` targets because Angular Rspack uses Nx's [Inferred Tasks](concepts/inferred-tasks) to build and serve your application with Rspack.

## Building your Angular Rspack application

To build your Angular Rspack application, run the following command:

```bash
npx nx build myapp
```

This command will build your Angular Rspack application and output the results to the `dist/browser` directory.  
If you are using the Angular Rspack application with Server-Side Rendering (SSR), the `dist/server` directory will contain the server files. The same `nx build` command will build both the client and server files.

## Serving your Angular Rspack application

To serve your Angular Rspack application, run the following command:

```bash
npx nx serve myapp
```

This command will serve your Angular Rspack application.  
For Client-Side Rendering (CSR) applications, the default port is `4200`. You can visit the application by navigating to `http://localhost:4200` in your browser.

For Server-Side Rendering (SSR) applications, the default port is `4000`. You can visit the application by navigating to `http://localhost:4000` in your browser.

HMR is enabled by default so you can make changes to your application and see the changes in real-time.

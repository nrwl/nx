---
title: Migrating an Angular CLI Project to Nx
description: Learn how to transform your Angular CLI workspace into an Nx workspace, either as a standalone app or a full monorepo, with automated migration tools.
sidebar:
  label: Migrating from Angular CLI
filter: 'type:Guides'
---

Within an Nx workspace, you gain many capabilities that help you build applications and libraries. If you are currently using an Angular CLI workspace, you can transform it into an Nx workspace.

## Migrating to a standalone Angular app with Nx

You can migrate to a standalone Angular app with the command:

```shell
npx nx@latest init
```

This command will install the correct version of Nx based on your Angular version.

This will enable you to use the Nx CLI in your existing Angular CLI workspace while keeping your existing file structure in place. The following changes will be made in your repo to enable Nx:

- The `nx`, `@nx/workspace` and `prettier` packages will be installed.
- An `nx.json` file will be created in the root of your workspace.
- For an Angular 14+ repo, the `angular.json` file is split into separate `project.json` files for each project.

**Note:** The changes will be slightly different for Angular 13 and lower.

## Migrating to an Nx Monorepo

If you want to migrate your Angular CLI project to an Nx Monorepo, run the following command:

```shell
npx nx@latest init --integrated
```

The command applies the following changes to your workspace:

- Installs the `nx`, `@nx/angular` and `@nx/workspace` packages.
- Moves your applications into the `apps` folder, and updates the relevant file paths in your configuration files.
- Moves your e2e suites into the `apps/<app name>-e2e` folder, and updates the relevant file paths in your configuration files.
- Moves your libraries into the `libs` folder, and updates the relevant file paths in your configuration files.
- Updates your `package.json` scripts to use `nx` instead of `ng`.
- Splits your `angular.json` into `project.json` files for each project with updated paths.

### Importing additional Angular CLI projects

If you have multiple Angular CLI workspaces that you want to consolidate into a single Nx monorepo, you can use [`nx import`](/docs/guides/adopting-nx/import-project) to bring additional projects into an existing Nx workspace while preserving their git history.

After the changes are applied, your workspace file structure should look similar to the one below:

{% filetree %}

- <workspace_name>/
  - apps/
    - <app_name>/
      - src/
        - app/
        - assets/
        - favicon.ico
        - index.html
        - main.ts
        - styles.css
        - project.json
        - tsconfig.app.json
        - tsconfig.spec.json
  - libs/
    - <lib_name>/
      - src/
      - ng-package.json
      - package.json
      - project.json
      - README.md
      - tsconfig.lib.json
      - tsconfig.lib.prod.json
      - tsconfig.spec.json
  - tools/
  - .editorconfig
  - .gitignore
  - .prettierignore
  - .prettierrc
  - nx.json
  - package.json
  - README.md
  - tsconfig.base.json

{% /filetree %}

## After migration

Your workspace is now powered by Nx! You can verify that your application still runs as intended:

- To serve, run `nx serve <app name>`.
- To build, run `nx build <app name>`.
- To run unit tests, run `nx test <app name>`.
- To see your project graph, run `nx graph`.

> Your project graph will grow as you add and use more applications and libraries. You can add the `--watch` flag to `nx graph` to see the changes in-browser as you add them.

For guidance on setting up CI, see the [CI setup guide](/docs/guides/nx-cloud/setup-ci).

## Learn more

Learn more about the advantages of Nx in the following guides:

- [Using Cypress for e2e tests](/docs/technologies/test-tools/cypress/introduction)
- [Using Jest for unit tests](/docs/technologies/test-tools/jest/introduction)
- [Computation Caching](/docs/concepts/how-caching-works)
- [Rebuilding and Retesting What is Affected](/docs/features/ci-features/affected)
- [Integrate with Editors](/docs/getting-started/editor-setup)
- [Advanced Angular Micro Frontends with Dynamic Module Federation](/docs/technologies/angular/guides/dynamic-module-federation-with-angular)

{% linkcard title="Nx and the Angular CLI" description="Differences between Nx and the Angular CLI" href="/docs/technologies/angular/guides/nx-and-angular" /%}

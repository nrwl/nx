---
title: Migrating an Angular CLI Project to Nx
description: Learn how to transform your Angular CLI workspace into an Nx workspace, either as a standalone app or a full monorepo, with automated migration tools.
---

# Migrating an Angular CLI project to Nx

Within an Nx workspace, you gain many capabilities that help you build applications and libraries. If you are currently using an Angular CLI workspace, you can transform it into an Nx workspace.

## Migrating to a Standalone Angular App with Nx

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

After the changes are applied, your workspace file structure should look similar to the one below:

```text
<workspace name>/
├── apps/
│   └─ <app name>/
│       ├── src/
│       │   ├── app/
│       │   ├── assets/
│       │   ├── favicon.ico
│       │   ├── index.html
│       │   ├── main.ts
│       │   └── styles.css
│       ├── project.json
│       ├── tsconfig.app.json
│       └── tsconfig.spec.json
├── libs/
│   └── <lib name>/
│       ├── src/
│       ├── ng-package.json
│       ├── package.json
│       ├── project.json
│       ├── README.md
│       ├── tsconfig.lib.json
│       ├── tsconfig.lib.prod.json
│       └── tsconfig.spec.json
├── tools/
├── .editorconfig
├── .gitignore
├── .prettierignore
├── .prettierrc
├── karma.conf.js
├── nx.json
├── package.json
├── README.md
└── tsconfig.base.json
```

### Modified Folder Structure

The automated migration supports Angular CLI workspaces with a standard structure, configurations and features. It supports workspaces using the following executors (builders):

- `@angular-devkit/build-angular:application`
- `@angular-devkit/build-angular:browser`
- `@angular-devkit/build-angular:browser-esbuild`
- `@angular-devkit/build-angular:dev-server`
- `@angular-devkit/build-angular:extract-i18n`
- `@angular-devkit/build-angular:karma`
- `@angular-devkit/build-angular:ng-packagr`
- `@angular-devkit/build-angular:prerender`
- `@angular-devkit/build-angular:protractor`
- `@angular-devkit/build-angular:server`
- `@angular-devkit/build-angular:ssr-dev-server`
- `@angular-eslint/builder:lint`
- `@cypress/schematic:cypress`
- `@nguniversal/builders:prerender`
- `@nguniversal/builders:ssr-dev-server`

Support for other executors may be added in the future.

## After migration

Your workspace is now powered by Nx! You can verify that your application still runs as intended:

- To serve, run `nx serve <app name>`.
- To build, run `nx build <app name>`.
- To run unit tests, run `nx test <app name>`.
- To see your project graph, run `nx graph`.

> Your project graph will grow as you add and use more applications and libraries. You can add the `--watch` flag to `nx graph` to see the changes in-browser as you add them.

## Set Up CI for Your Angular Workspace

This tutorial walked you through how Nx can improve the local development experience, but the biggest difference Nx makes is in CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/concepts/parallelization-distribution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).

### Connect to Nx Cloud

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

Now that we're working on the CI pipeline, it is important for your changes to be pushed to a GitHub repository.

1. Commit your existing changes with `git add . && git commit -am "updates"`
2. [Create a new GitHub repository](https://github.com/new)
3. Follow GitHub's instructions to push your existing code to the repository

Now connect your repository to Nx Cloud with the following command:

```shell
npx nx@latest connect
```

A browser window will open to register your repository in your [Nx Cloud](https://cloud.nx.app) account. The link is also printed to the terminal if the windows does not open, or you closed it before finishing the steps. The app will guide you to create a PR to enable Nx Cloud on your repository.

![](/shared/tutorials/nx-cloud-github-connect.avif)

Once the PR is created, merge it into your main branch.

![](/shared/tutorials/github-cloud-pr-merged.avif)

And make sure you pull the latest changes locally:

```shell
git pull
```

You should now have an `nxCloudId` property specified in the `nx.json` file.

### Create a CI Workflow

Use the following command to generate a CI workflow file.

```shell
npx nx generate ci-workflow --ci=github
```

This generator creates a `.github/workflows/ci.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects that are affected by any given PR. Since we are using Nx Cloud, the pipeline will also distribute tasks across multiple machines to ensure fast and reliable CI runs.

The key lines in the CI pipeline are:

```yml {% fileName=".github/workflows/ci.yml" highlightLines=["10-14", "21-22"] %}
name: CI
# ...
jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          filter: tree:0

      # This enables task distribution via Nx Cloud
      # Run this command as early as possible, before dependencies are installed
      # Learn more at https://nx.dev/ci/reference/nx-cloud-cli#npx-nxcloud-startcirun
      # Connect your workspace by running "nx connect" and uncomment this
      - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js" --stop-agents-after="build"
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci --legacy-peer-deps
      - uses: nrwl/nx-set-shas@v4
      # Nx Affected runs only tasks affected by the changes in this PR/commit. Learn more: https://nx.dev/ci/features/affected
      - run: npx nx affected -t lint test build
```

### Open a Pull Request

Commit the changes and open a new PR on GitHub.

```shell
git add .
git commit -m 'add CI workflow file'
git push origin add-workflow
```

When you view the PR on GitHub, you will see a comment from Nx Cloud that reports on the status of the CI run.

![Nx Cloud report](/shared/tutorials/github-pr-cloud-report.avif)

The `See all runs` link goes to a page with the progress and results of tasks that were run in the CI pipeline.

![Run details](/shared/tutorials/nx-cloud-run-details.avif)

For more information about how Nx can improve your CI pipeline, check out one of these guides:

- [GitHub Actions with Nx](/ci/recipes/set-up/monorepo-ci-github-actions)
- [Circle CI with Nx](/ci/recipes/set-up/monorepo-ci-circle-ci)
- [Azure Pipelines with Nx](/ci/recipes/set-up/monorepo-ci-azure)
- [Bitbucket Pipelines with Nx](/ci/recipes/set-up/monorepo-ci-bitbucket-pipelines)
- [GitLab with Nx](/ci/recipes/set-up/monorepo-ci-gitlab)

## Learn More

Learn more about the advantages of Nx in the following guides:

- [Using Cypress for e2e tests](/technologies/test-tools/cypress/introduction)
- [Using Jest for unit tests](/technologies/test-tools/jest/introduction)
- [Computation Caching](/concepts/how-caching-works)
- [Rebuilding and Retesting What is Affected](/ci/features/affected)
- [Integrate with Editors](/getting-started/editor-setup)
- [Advanced Angular Micro Frontends with Dynamic Module Federation](/technologies/angular/recipes/dynamic-module-federation-with-angular)

## From Nx Console

Nx Console no longer supports the Angular CLI. Angular CLI users will receive a notice, asking if they want to switch to Nx. When you click this button, we'll run the `nx init` command to set up the Nx CLI, allowing for cached builds, and for you to share this cache with your teammates via Nx Cloud.

If you're not ready to make the change yet, you can come back to this later:

- If you're using Nx Console: open the Vs Code command palette and start typing "Convert Angular CLI to Nx Workspace".
- Regardless of using Nx Console (or your IDE): run `npx nx@latest init` from the root of your project.

Once the script has run, commit the changes. Reverting this commit will effectively undo the changes made.

{% cards cols="1" mdCols="3" smCols="3" lgCols="3" %}

{% card title="Nx and the Angular CLI" description="Differences between Nx and the Angular CLI" type="documentation" url="/technologies/angular/recipes/nx-and-angular" /%}

{% card title="Multiple Angular Repositories to one Nx Workspace" description="Combine multiple Angular CLI workspaces into one Nx workspace" type="documentation" url="technologies/angular/migration/angular-multiple" /%}

{% /cards %}

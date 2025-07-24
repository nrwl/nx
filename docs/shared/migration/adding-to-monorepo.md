---
title: Adding Nx to NPM/Yarn/PNPM Workspace
description: Learn how to integrate Nx into an existing NPM, Yarn, or PNPM workspace monorepo to gain task scheduling, caching, and improved CI performance.
---

# Adding Nx to NPM/Yarn/PNPM Workspace

{% callout type="note" title="Migrating from Lerna?" %}
Interested in migrating from [Lerna](https://github.com/lerna/lerna) in particular? In case you missed it, Lerna v6 is
powering Nx underneath. As a result, Lerna gets all the modern features such as caching and task pipelines. Read more
on [https://lerna.js.org/upgrade](https://lerna.js.org/upgrade).
{% /callout %}

Nx has first-class support for [monorepos](/getting-started/tutorials/typescript-packages-tutorial). If you have
an existing NPM/Yarn or PNPM-based monorepo setup, you can easily add Nx to get

- fast [task scheduling](/features/run-tasks)
- high-performance task [caching](/features/cache-task-results)
- [fast CI ⚡](#fast-ci) with [remote caching](/ci/features/remote-cache) and [distributed task execution](/ci/features/distribute-task-execution)

This is a low-impact operation because all that needs to be done is to install the `nx` package at the root level and
add an `nx.json` for configuring caching and task pipelines.

{% course-video src="https://youtu.be/3hW53b1IJ84" courseTitle="From PNPM Workspaces to Distributed CI" courseUrl="/courses/pnpm-nx-next/lessons-01-nx-init" title="Initialize Nx in Your Project with nx init" /%}

## Installing Nx

Run the following command to automatically set up Nx:

```shell
npx nx@latest init
```

Running this command will ask you a few questions about your workspace and then set up Nx for you accordingly. The setup
process detects tools which are used in your workspace and suggests installing Nx plugins to integrate the tools you use
with Nx. Running those tools through Nx will have caching enabled when possible, providing you with a faster alternative
for running those tools. You can start with a few to see how it works and then add more with
the [`nx add`](/reference/core-api/nx/documents/add) command later. You can also decide to add them all and get the full experience
right
away because adding plugins will not break your existing workflow.

The first thing you may notice is that Nx updates your `package.json` scripts during the setup process. Nx Plugins setup
Nx commands which run the underlying tool with caching enabled. When a `package.json` script runs a command which can be
run through Nx, Nx will replace that script in the `package.json` scripts with an Nx command that has
caching automatically enabled. Anywhere those `package.json` scripts are used, including your CI, will become faster
when possible. Let's go through an example where the `@nx/next/plugin` and `@nx/eslint/plugin` plugins are added to a
workspace with the
following `package.json`.

```diff {% fileName="package.json" %}
{
  "name": "my-workspace",
  ...
  "scripts": {
-     "build": "next build && echo 'Build complete'",
+     "build": "nx next:build && echo 'Build complete'",
-     "lint": "eslint ./src",
+     "lint": "nx eslint:lint",
    "test": "node ./run-tests.js"
  },
  ...
}
```

The `@nx/next/plugin` plugin adds a `next:build` target which runs `next build` and sets up caching correctly. In other
words, running `nx next:build` is the same as running `next build` with the added benefit of it being cacheable. Hence,
Nx replaces `next build` in the `package.json` `build` script to add caching to anywhere running `npm run build`.
Similarly, `@nx/eslint/plugin` sets up the `nx eslint:lint` command to run `eslint ./src` with caching enabled.
The `test` script was not recognized by any Nx plugin, so it was left as is. After Nx has been setup,
running `npm run build` or `npm run lint` multiple times, will be instant when possible.

You can also run any npm scripts directly through Nx with `nx build` or `nx lint` which will run the `npm run build`
and `npm run lint` scripts respectively. In the later portion of the setup flow, Nx will ask if you would like some of
those npm scripts to be cacheable. By making those cacheable, running `nx build` rather than `npm run build` will add
another layer of cacheability. However, `nx build` must be run instead of `npm run build` to take advantage of the
cache.

## Inferred Tasks

You may have noticed that `@nx/next` provides `dev` and `start` tasks in addition to the `next:build` task. Those tasks
were created by the `@nx/next/plugin` plugin from your existing Next.js configuration. You can see the configuration for
the Nx Plugins in `nx.json`:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "eslint:lint"
      }
    },
    {
      "plugin": "@nx/next/plugin",
      "options": {
        "buildTargetName": "next:build",
        "devTargetName": "dev",
        "startTargetName": "start"
      }
    }
  ]
}
```

Each plugin can accept options to customize the projects which they create. You can see more information about
configuring the plugins on the [`@nx/next/plugin`](/technologies/react/next/introduction) and [`@nx/eslint/plugin`](/technologies/eslint/introduction) plugin pages.

To view all available tasks, open the Project Details view with Nx Console or use the terminal to launch the project
details in a browser window.

```shell
nx show project my-workspace --web
```

{% project-details title="Project Details View" %}

```json
{
  "project": {
    "name": "my-workspace",
    "data": {
      "root": ".",
      "targets": {
        "eslint:lint": {
          "cache": true,
          "options": {
            "cwd": ".",
            "command": "eslint ./src"
          },
          "inputs": [
            "default",
            "{workspaceRoot}/.eslintrc",
            "{workspaceRoot}/tools/eslint-rules/**/*",
            {
              "externalDependencies": ["eslint"]
            }
          ],
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["eslint"]
          }
        },
        "next:build": {
          "options": {
            "cwd": ".",
            "command": "next build"
          },
          "dependsOn": ["^build"],
          "cache": true,
          "inputs": [
            "default",
            "^default",
            {
              "externalDependencies": ["next"]
            }
          ],
          "outputs": ["{projectRoot}/.next", "{projectRoot}/.next/!(cache)"],
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["next"]
          }
        },
        "dev": {
          "options": {
            "cwd": ".",
            "command": "next dev",
            "continuous": true
          },
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["next"]
          }
        },
        "start": {
          "options": {
            "cwd": ".",
            "command": "next start",
            "continuous": true
          },
          "dependsOn": ["build"],
          "executor": "nx:run-commands",
          "configurations": {},
          "metadata": {
            "technologies": ["next"]
          }
        }
      },
      "sourceRoot": ".",
      "name": "my-workspace",
      "projectType": "library",
      "implicitDependencies": [],
      "tags": []
    }
  },
  "sourceMap": {
    "root": ["package.json", "nx/core/package-json-workspaces"],
    "targets": ["package.json", "nx/core/package-json-workspaces"],
    "targets.eslint:lint": [".eslintrc.json", "@nx/eslint/plugin"],
    "targets.eslint:lint.command": [".eslintrc.json", "@nx/eslint/plugin"],
    "targets.eslint:lint.cache": [".eslintrc.json", "@nx/eslint/plugin"],
    "targets.eslint:lint.options": [".eslintrc.json", "@nx/eslint/plugin"],
    "targets.eslint:lint.inputs": [".eslintrc.json", "@nx/eslint/plugin"],
    "targets.eslint:lint.options.cwd": [".eslintrc.json", "@nx/eslint/plugin"],
    "targets.next:build": ["next.config.js", "@nx/next/plugin"],
    "targets.next:build.command": ["next.config.js", "@nx/next/plugin"],
    "targets.next:build.options": ["next.config.js", "@nx/next/plugin"],
    "targets.next:build.dependsOn": ["next.config.js", "@nx/next/plugin"],
    "targets.next:build.cache": ["next.config.js", "@nx/next/plugin"],
    "targets.next:build.inputs": ["next.config.js", "@nx/next/plugin"],
    "targets.next:build.outputs": ["next.config.js", "@nx/next/plugin"],
    "targets.next:build.options.cwd": ["next.config.js", "@nx/next/plugin"],
    "targets.dev": ["next.config.js", "@nx/next/plugin"],
    "targets.dev.command": ["next.config.js", "@nx/next/plugin"],
    "targets.dev.options": ["next.config.js", "@nx/next/plugin"],
    "targets.dev.options.cwd": ["next.config.js", "@nx/next/plugin"],
    "targets.start": ["next.config.js", "@nx/next/plugin"],
    "targets.start.command": ["next.config.js", "@nx/next/plugin"],
    "targets.start.options": ["next.config.js", "@nx/next/plugin"],
    "targets.start.dependsOn": ["next.config.js", "@nx/next/plugin"],
    "targets.start.options.cwd": ["next.config.js", "@nx/next/plugin"],
    "sourceRoot": ["package.json", "nx/core/package-json-workspaces"],
    "name": ["package.json", "nx/core/package-json-workspaces"],
    "projectType": ["package.json", "nx/core/package-json-workspaces"],
    "targets.nx-release-publish": [
      "package.json",
      "nx/core/package-json-workspaces"
    ],
    "targets.nx-release-publish.dependsOn": [
      "package.json",
      "nx/core/package-json-workspaces"
    ],
    "targets.nx-release-publish.executor": [
      "package.json",
      "nx/core/package-json-workspaces"
    ],
    "targets.nx-release-publish.options": [
      "package.json",
      "nx/core/package-json-workspaces"
    ]
  }
}
```

{% /project-details %}

The project detail view lists all available tasks, the configuration values for those tasks and where those
configuration values are being set.

## Configure an Existing Script to Run with Nx

If you want to run one of your existing scripts with Nx, you need to tell Nx about it.

1. Preface the script with `nx exec -- ` to have `npm run test` invoke the command with Nx.
2. Define caching settings.

The `nx exec` command allows you to keep using `npm test` or `npm run test` (or other package manager's alternatives) as
you're accustomed to. But still get the benefits of making those operations cacheable. Configuring the `test` script
from the example above to run with Nx would look something like this:

```json {% fileName="package.json" %}
{
  "name": "my-workspace",
  ...
  "scripts": {
    "build": "nx next:build",
    "lint": "nx eslint:lint",
    "test": "nx exec -- node ./run-tests.js"
  },
  ...
  "nx": {
    "targets": {
      "test": {
        "cache": "true",
        "inputs": [
          "default",
          "^default"
        ],
        "outputs": []
      }
    }
  }
}
```

Now if you run `npm run test` or `nx test` twice, the results will be retrieved from the cache. The `inputs` used in
this example are as cautious as possible, so you can significantly improve the value of the cache
by [customizing Nx Inputs](/recipes/running-tasks/configure-inputs) for each task.

## Incrementally Adopting Nx

All the features of Nx can be enabled independently of each other. Hence, Nx can easily be adopted incrementally by
initially using Nx just for a subset of your scripts and then gradually adding more.

For example, use Nx to run your builds:

```shell
npx nx run-many -t build
```

But instead keep using NPM/Yarn/PNPM workspace commands for your tests and other scripts. Here's an example of using
PNPM commands to run tests across packages

```shell
pnpm run -r test
```

This allows for incrementally adopting Nx in your existing workspace.

## Fast CI ⚡ {% highlightColor="green" %}

This tutorial walked you through how Nx can improve the local development experience, but the biggest difference Nx makes is in CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/concepts/parallelization-distribution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).

### Connect to Nx Cloud {% highlightColor="green" %}

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

Now that we're working on the CI pipeline, it is important for your changes to be pushed to a GitHub repository.

1. Commit your existing changes with `git add . && git commit -am "updates"`
2. [Create a new GitHub repository](https://github.com/new)
3. Follow GitHub's instructions to push your existing code to the repository

Now connect your repository to Nx Cloud with the following command:

```shell
npx nx connect
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

### Create a CI Workflow {% highlightColor="green" %}

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

### Open a Pull Request {% highlightColor="green" %}

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

For more information about how Nx can improve your CI pipeline, check out one of these detailed tutorials:

- [GitHub Actions with Nx](/ci/recipes/set-up/monorepo-ci-github-actions)
- [Circle CI with Nx](/ci/recipes/set-up/monorepo-ci-circle-ci)
- [Azure Pipelines with Nx](/ci/recipes/set-up/monorepo-ci-azure)
- [Bitbucket Pipelines with Nx](/ci/recipes/set-up/monorepo-ci-bitbucket-pipelines)
- [GitLab with Nx](/ci/recipes/set-up/monorepo-ci-gitlab)

## Learn More

{% cards %}

{% card title="Cache Task Results" description="Learn more about how caching works" type="documentation" url="
/features/cache-task-results" /%}

{% card title="Task Pipeline Configuration" description="Learn more about how to setup task dependencies" type="
documentation" url="/concepts/task-pipeline-configuration" /%}

{% card title="Nx Ignore" description="Learn about how to ignore certain projects using .nxignore" type="documentation"
url="/reference/nxignore" /%}

{% card title="Migrating from Turborepo to Nx" description="Read about Migrating from Turborepo to Nx" url="
/recipes/adopting-nx/from-turborepo" /%}

{% /cards %}

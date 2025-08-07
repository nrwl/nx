---
title: 'TypeScript Monorepo Tutorial'
description: In this tutorial you'll create a TypeScript monorepo with Nx.
---

# Building and Testing TypeScript Packages in Nx

This tutorial walks you through creating a TypeScript monorepo with Nx. You'll build a small example project to understand the core concepts and workflows.

What you'll learn:

- How to structure multiple TypeScript packages in a single repository
- How Nx's caching speeds up your local development and CI pipelines
- How to run builds and tests efficiently across multiple packages
- How to share code between packages using local libraries
- How to fix CI failures directly from your editor with Nx Cloud

## Ready to start?

{% callout type="note" title="Prerequisites" %}
This tutorial requires a [GitHub account](https://github.com) to demonstrate the full value of **Nx** - including task running, caching, and CI integration.
{% /callout %}

### Step 1: Creating a new Nx TypeScript workspace

Let's create your workspace. The setup process takes about 2 minutes and will configure TypeScript, testing, and CI/CD automatically.

{% call-to-action title="Join 1M+ Developers Using Nx Cloud 🚀" url="https://cloud.nx.app/create-nx-workspace?preset=typescript" description="Transform your TypeScript workflow - Setup takes less than 2 minutes" /%}

### Step 2: Verify Your Setup

Please verify closely that you have the following setup:

1. A new Nx workspace on your local machine
2. A corresponding GitHub repository for the workspace with a `.github/workflows/ci.yml` pipeline preconfigured
3. You completed the full Nx Cloud onboarding and you now have a Nx Cloud dashboard that is connected to your example repository on GitHub.

You should see your workspace in your [Nx Cloud organization](https://cloud.nx.app/orgs).

![](/shared/images/tutorials/connected-workspace.avif)

If you do not see your workspace in Nx Cloud then please follow the steps outlined in the [Nx Cloud setup](https://cloud.nx.app/create-nx-workspace?preset=typescript).

This is important for using remote caching and self-healing in CI later in the tutorial.

## Explore the Nx Workspace Setup

Let's take a look at the structure of our new Nx workspace:

```plaintext
acme
├─ .github
│  └─ workflows
│     └─ ci.yml
├─ .nx
│  └─ ...
├─ packages
│  └─ .gitkeep
├─ README.md
├─ .prettierignore
├─ .prettierrc
├─ nx.json
├─ package-lock.json
├─ package.json
├─ tsconfig.base.json
└─ tsconfig.json
```

Here are some files that might jump to your eyes:

- The `.nx` folder is where Nx stores local metadata about your workspaces using the [Nx Daemon](/concepts/nx-daemon).
- The [`nx.json` file](/reference/nx-json) contains configuration settings for Nx itself and global default settings that individual projects inherit.
- The `.github/workflows/ci.yml` file preconfigures your CI in GitHub Actions to run build and test through Nx.

Now, let's build some features and see how Nx helps get us to production faster.

## Building TypeScript Packages

Let's create two TypeScript packages that demonstrate how to structure a TypeScript monorepo. We'll create an `animal` package and a `zoo` package where `zoo` depends on `animal`.

First, generate the `animal` package:

```shell
npx nx g @nx/js:lib packages/animal --bundler=tsc --unitTestRunner=vitest --linter=none
```

Then generate the `zoo` package:

```shell
npx nx g @nx/js:lib packages/zoo --bundler=tsc --unitTestRunner=vitest --linter=none
```

Running these commands should lead to new directories and files in your workspace:

```plaintext
acme
├── packages
│   ├── animal
│   └── zoo
├── ...
└── vitest.workspace.ts
```

Let's add some code to our packages. First, add the following code to the `animal` package:

```ts {% fileName="packages/animal/src/lib/animal.ts" highlightLines=["5-18"] %}
export function animal(): string {
  return 'animal';
}

export interface Animal {
  name: string;
  sound: string;
}

const animals: Animal[] = [
  { name: 'cow', sound: 'moo' },
  { name: 'dog', sound: 'woof' },
  { name: 'pig', sound: 'oink' },
];

export function getRandomAnimal(): Animal {
  return animals[Math.floor(Math.random() * animals.length)];
}
```

Now let's update the `zoo` package to use the `animal` package:

```ts {% fileName="packages/zoo/src/lib/zoo.ts" %}
import { getRandomAnimal } from '@acme/animal';

export function zoo(): string {
  const result = getRandomAnimal();
  return `${result.name} says ${result.sound}!`;
}
```

Also create an executable entry point for the zoo package:

```ts {% fileName="packages/zoo/src/index.ts" %}
import { zoo } from './lib/zoo.js';

console.log(zoo());
```

To build your packages, run:

```shell
npx nx build animal
```

This creates a compiled version of your package in the `dist/packages/animal` folder. Since the `zoo` package depends on `animal`, building `zoo` will automatically build `animal` first:

```shell
npx nx build zoo
```

You'll see both packages are built, with outputs in their respective `dist` folders. This is how you would prepare packages for use internally or for publishing to a package registry like NPM.

You can also run the `zoo` package to see it in action:

```shell
node packages/zoo/dist/index.js
```

Nx uses the following syntax to run tasks:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Inferred Tasks

By default Nx simply runs your `package.json` scripts. However, you can also adopt [Nx technology plugins](/technologies) that help abstract away some of the lower-level config and have Nx manage that. One such thing is to automatically identify tasks that can be run for your project from [tooling configuration files](/concepts/inferred-tasks) such as `package.json` scripts and TypeScript configuration.

In `nx.json` there's already the `@nx/js` plugin registered which automatically identifies `typecheck` and `build` targets.

```json {% fileName="nx.json" %}
{
  ...
  "plugins": [
    {
      "plugin": "@nx/js/typescript",
      "options": {
        "typecheck": {
          "targetName": "typecheck"
        },
        "build": {
          "targetName": "build",
          "configName": "tsconfig.lib.json",
          "buildDepsName": "build-deps",
          "watchDepsName": "watch-deps"
        }
      }
    }
  ]
}

```

To view the tasks that Nx has detected, look in the [Nx Console](/getting-started/editor-setup) project detail view or run:

```shell
npx nx show project animal
```

{% project-details title="Project Details View (Simplified)" %}

```json
{
  "project": {
    "name": "@acme/animal",
    "type": "lib",
    "data": {
      "root": "packages/animal",
      "targets": {
        "typecheck": {
          "dependsOn": ["^typecheck"],
          "options": {
            "cwd": "packages/animal",
            "command": "tsc --build --emitDeclarationOnly"
          },
          "cache": true,
          "inputs": [
            "production",
            "^production",
            {
              "externalDependencies": ["typescript"]
            }
          ],
          "outputs": ["{projectRoot}/dist"],
          "executor": "nx:run-commands",
          "configurations": {}
        },
        "build": {
          "options": {
            "cwd": "packages/animal",
            "command": "tsc --build tsconfig.lib.json"
          },
          "cache": true,
          "dependsOn": ["^build"],
          "inputs": [
            "production",
            "^production",
            {
              "externalDependencies": ["typescript"]
            }
          ],
          "outputs": ["{projectRoot}/dist"],
          "executor": "nx:run-commands",
          "configurations": {}
        }
      },
      "name": "animal",
      "$schema": "../../node_modules/nx/schemas/project-schema.json",
      "sourceRoot": "packages/animal/src",
      "projectType": "library",
      "tags": [],
      "implicitDependencies": []
    }
  },
  "sourceMap": {
    "root": ["packages/animal/project.json", "nx/core/project-json"],
    "targets": ["packages/animal/project.json", "nx/core/project-json"],
    "targets.typecheck": ["packages/animal/project.json", "@nx/js/typescript"],
    "targets.typecheck.command": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.typecheck.options": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.typecheck.cache": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.typecheck.dependsOn": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.typecheck.inputs": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.typecheck.outputs": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.typecheck.options.cwd": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.build": ["packages/animal/project.json", "@nx/js/typescript"],
    "targets.build.command": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.build.options": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.build.cache": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.build.dependsOn": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.build.inputs": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.build.outputs": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "targets.build.options.cwd": [
      "packages/animal/project.json",
      "@nx/js/typescript"
    ],
    "name": ["packages/animal/project.json", "nx/core/project-json"],
    "$schema": ["packages/animal/project.json", "nx/core/project-json"],
    "sourceRoot": ["packages/animal/project.json", "nx/core/project-json"],
    "projectType": ["packages/animal/project.json", "nx/core/project-json"],
    "tags": ["packages/animal/project.json", "nx/core/project-json"]
  }
}
```

{% /project-details %}

The `@nx/js` plugin automatically configures both the build and typecheck tasks based on your TypeScript configuration. Notice also how the outputs are set to `{projectRoot}/dist` - this is where your compiled TypeScript files will be placed, and it defined by the `outDir` option in `packages/animal/tsconfig.lib.json`.

{% callout type="note" title="Overriding inferred task options" %}
You can override the options for inferred tasks by modifying the [`targetDefaults` in `nx.json`](/reference/nx-json#target-defaults) or setting a value in your [`project.json` file](/reference/project-configuration). Nx will merge the values from the inferred tasks with the values you define in `targetDefaults` and in your specific project's configuration.
{% /callout %}

## Code Sharing with Local Libraries

When you develop packages, creating shared utilities that multiple packages can use is a common pattern. This approach offers several benefits:

- better separation of concerns
- better reusability
- more explicit APIs between different parts of your system
- better scalability in CI by enabling independent test/lint/build commands for each package
- most importantly: better caching because changes to one package don't invalidate the cache for unrelated packages

### Create a Shared Utilities Library

Let's create a shared utilities library that both our existing packages can use:

```shell
npx nx g @nx/js:library packages/util --bundler=tsc --unitTestRunner=vitest --linter=none
```

Now we have:

```plaintext
acme
├── packages
│   ├── animal
│   ├── util
│   └── zoo
└── ...
```

Let's add a utility function that our packages can share:

```ts {% fileName="packages/util/src/lib/util.ts"  highlightLines=["5-11"] %}
export function util(): string {
  return 'util';
}

export function formatMessage(prefix: string, message: string): string {
  return `[${prefix}] ${message}`;
}

export function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}
```

### Import the Shared Library

This allows us to easily import them into other packages. Let's update our `animals` package to use the shared utility:

```ts {% fileName="packages/animals/src/lib/animals.ts"  highlightLines=[1, "18-20"]%}
import { getRandomItem } from '@acme/util';

export function animal(): string {
  return 'animal';
}

export interface Animal {
  name: string;
  sound: string;
}

const animals: Animal[] = [
  { name: 'cow', sound: 'moo' },
  { name: 'dog', sound: 'woof' },
  { name: 'pig', sound: 'oink' },
];

export function getRandomAnimal(): Animal {
  return getRandomItem(animals);
}
```

And update the `zoo` package to use the formatting utility:

```ts {% fileName="packages/zoo/src/lib/zoo.ts"  highlightLines=[2, 6, 7] %}
import { getRandomAnimal } from '@acme/animal';
import { formatMessage } from '@acme/util';

export function zoo(): string {
  const result = getRandomAnimal();
  const message = `${result.name} says ${result.sound}!`;
  return formatMessage('ZOO', message);
}
```

Now when you run `npx nx build zoo`, Nx will automatically build all the dependencies in the correct order: first `util`, then `animal`, and finally `zoo`.

Run the `zoo` package to see the updated output format:

```shell
node packages/zoo/dist/index.js
```

## Visualize your Project Structure

Nx automatically detects the dependencies between the various parts of your workspace and builds a [project graph](/features/explore-graph). This graph is used by Nx to perform various optimizations such as determining the correct order of execution when running tasks like `npx nx build`, enabling intelligent caching, and more. Interestingly, you can also visualize it.

Just run:

```shell
npx nx graph
```

You should be able to see something similar to the following in your browser.

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "@acme/animal",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "@acme/util",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "@acme/zoo",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "@acme/animal": [
      { "source": "@acme/animal", "target": "@acme/util", "type": "static" }
    ],
    "@acme/util": [],
    "@acme/zoo": [
      { "source": "@acme/zoo", "target": "@acme/animal", "type": "static" },
      { "source": "@acme/zoo", "target": "@acme/util", "type": "static" }
    ]
  },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

Let's create a git branch with our new packages so we can open a pull request later:

```shell
git checkout -b add-zoo-packages
git add .
git commit -m 'add animal and zoo packages'
```

## Building and Testing - Running Multiple Tasks

Our packages come with preconfigured building and testing . Let's intentionally introduce a typo in our test to demonstrate the self-healing CI feature later.

You can run tests for individual packages:

```shell
npx nx build zoo
```

Or run multiple tasks in parallel across all packages:

```shell
npx nx run-many -t build test
```

This is exactly what is configured in `.github/workflows/ci.yml` for the CI pipeline. The `run-many` command allows you to run multiple tasks across multiple projects in parallel, which is particularly useful in a monorepo setup.

There is a test failure for the `zoo` package due to the updated message. Don't worry about it for now, we'll fix it in a moment with the help of Nx Cloud's self-healing feature.

### Local Task Cache

One thing to highlight is that Nx is able to [cache the tasks you run](/features/cache-task-results).

Note that all of these targets are automatically cached by Nx. If you re-run a single one or all of them again, you'll see that the task completes immediately. In addition, there will be a note that a matching cache result was found and therefore the task was not run again.

```{% command="npx nx run-many -t built test" path="~/acme" %}
      ✔  nx run @acme/util:build
   ✔  nx run @acme/util:test
   ✔  nx run @acme/animal:test
   ✔  nx run @acme/animal:build
   ✖  nx run @acme/zoo:test
   ✔  nx run @acme/zoo:build

——————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————————

 NX   Ran targets test, build for 3 projects (800ms)

   ✔  5/6 succeeded [5 read from cache]

   ✖  1/6 targets failed, including the following:

      - nx run @acme/zoo:test
```

Not all tasks might be cacheable though. You can configure the `cache` settings in the `targetDefaults` property of the `nx.json` file. You can also [learn more about how caching works](/features/cache-task-results).

## Self-Healing CI with Nx Cloud

In this section, we'll explore how Nx Cloud can help your pull request get to green faster with self-healing CI. Recall that our zoo package has a test with a typo, so let's see how this can be automatically resolved.

The `npx nx-cloud fix-ci` command that is already included in your GitHub Actions workflow (`github/workflows/ci.yml`) is responsible for enabling self-healing CI and will automatically suggest fixes to your failing tasks.

```yaml {% fileName=".github/workflows/ci.yml" highlightLines=[31,32] %}
name: CI

on:
  push:
    branches:
      - main
  pull_request:

permissions:
  actions: read
  contents: read

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          filter: tree:0
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci --legacy-peer-deps

      - run: npx nx run-many -t lint test build

      - run: npx nx-cloud fix-ci
        if: always()
```

You will also need to install the [Nx Console](/getting-started/editor-setup) editor extension for VS Code, Cursor, or IntelliJ. For the complete AI setup guide, see our [AI integration documentation](/getting-started/ai-integration).

{% install-nx-console /%}

Now, let's push the `add-zoo-packages` branch to GitHub and open a new pull request.

```shell
git push origin add-zoo-packages
# Don't forget to open a pull request on GitHub
```

As expected, the CI check may show failures or issues. But rather than looking at the pull request, Nx Console notifies you that the run has completed, and if there are any issues, it may have suggested fixes. This means that you don't have to waste time **babysitting your PRs**, and fixes can be applied directly from your editor.

![Nx Console with notification](/shared/images/tutorials/ts-ci-notification.avif)

### Fix CI from Your Editor

From the Nx Console notification, if there's a suggested fix (such as fixing the typo "formated" to "formatted"), you can click `Show Suggested Fix` button. Review the suggested fix and approve it by clicking `Apply Fix`.

![Suggestion to fix the typo in the editor](/shared/images/tutorials/ts-ci-suggestion.avif)

You didn't have to leave your editor or do any manual work to fix it. This is the power of self-healing CI with Nx Cloud.

### Remote Cache for Faster Time To Green

After the fix has been applied and committed, CI will re-run automatically, and you will be notified of the results in your editor.

![Notication of successful run](/shared/images/tutorials/ts-remote-cache-notification.avif)

When you click `View Results` to show the run in Nx Cloud, you'll notice something interesting. The tasks for packages that weren't affected by your change were read from remote cache and did not have to run again, thus each taking less than a second to complete.

![Nx Cloud run showing remote cache hits](/shared/images/tutorials/ts-remote-cache-cloud.avif)

This happens because Nx Cloud caches the results of tasks and reuses them across different CI runs. As long as the inputs for each task have not changed (e.g. source code), then their results can be replayed from Nx Cloud's [Remote Cache](/ci/features/remote-cache).

This significantly speeds up the time to green for your pull requests, because subsequent changes to them have a good chance to replay tasks from cache.

{% callout type="note" title="Remote Cache Outputs" %}
Outputs from cached tasks, such as the `dist` folder for builds or `coverage` folder for tests, are also read from cache. Even though a task was not run again, its outputs are available. The [Cache Task Results](/features/cache-task-results) page provides more details on caching.
{% /callout %}

This pull request is now ready to be merged with the help of Nx Cloud's self-healing CI and remote caching.

![Pull request is green](/shared/images/tutorials/ts-ci-green.avif)

The next section deals with publishing packages to a registry like NPM, but if you are not interested in publishing your packages, you can skip to [the end](#next-steps).

## Manage Releases

If you decide to publish your packages to NPM, Nx can help you [manage the release process](/features/manage-releases). Release management involves updating the version of your packages, populating a changelog, and publishing the new version to the NPM registry.

First you'll need to define which projects Nx should manage releases for by setting the `release.projects` property in `nx.json`:

```json {% fileName="nx.json" highlightLines=["3-5"] %}
{
  ...
  "release": {
    "projects": ["packages/*"]
  }
}
```

You'll also need to ensure that each package's `package.json` file sets `"private": false` so that Nx can publish them. If you have any packages that you do not want to publish, make sure to set `"private": true` in their `package.json`.

Now you're ready to use the `nx release` command to publish your packages. The first time you run `nx release`, you need to add the `--first-release` flag so that Nx doesn't try to find the previous version to compare against. It's also recommended to use the `--dry-run` flag until you're sure about the results of the `nx release` command, then you can run it a final time without the `--dry-run` flag.

To preview your first release, run:

```shell
npx nx release --first-release --dry-run
```

The command will ask you a series of questions and then show you what the results would be. Once you are happy with the results, run it again without the `--dry-run` flag:

```shell
npx nx release --first-release
```

After this first release, you can remove the `--first-release` flag and just run `nx release --dry-run`. There is also a [dedicated feature page](/features/manage-releases) that goes into more detail about how to use the `nx release` command.

## Next Steps

Here are some things you can dive into next:

- Learn more about the [underlying mental model of Nx](/concepts/mental-model)
- Learn how to [migrate your existing project to Nx](/recipes/adopting-nx/adding-to-existing-project)
- [Learn more about Nx release for publishing packages](/features/manage-releases)
- Learn about [enforcing boundaries between projects](/features/enforce-module-boundaries)

Also, make sure you

- ⭐️ [Star us on GitHub](https://github.com/nrwl/nx) to show your support and stay updated on new releases!
- [Join the Official Nx Discord Server](https://go.nx.dev/community) to ask questions and find out the latest news about Nx.
- [Follow Nx on Twitter](https://twitter.com/nxdevtools) to stay up to date with Nx news
- [Read our Nx blog](/blog)
- [Subscribe to our Youtube channel](https://www.youtube.com/@nxdevtools) for demos and Nx insights

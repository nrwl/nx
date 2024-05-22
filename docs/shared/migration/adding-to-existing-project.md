# Adding Nx to your Existing Project

Nx can be added to any type of project, not just monorepos. The main benefit is to get caching abilities for the package
scripts. Each project usually has a set of scripts in the `package.json`:

```json {% fileName="package.json" %}
{
  ...
  "scripts": {
    "build": "next build",
    "lint": "eslint ./src",
    "test": "node ./run-tests.js"
  }
}
```

You can make these scripts faster by leveraging Nx's caching capabilities. For example:

- You change some spec files: in that case the `build` task can be cached and doesn't have to re-run.
- You update your docs, changing a couple of markdown files: then there's no need to re-run builds, tests, linting on
  your CI. All you might want to do is trigger the Docusaurus build.

## Install Nx on a Non-Monorepo Project

Run the following command:

```shell
npx nx@latest init
```

Running this command will ask you a few questions about your workspace and then set up Nx for you accordingly. The setup
process detects tools which are used in your workspace and suggests installing Nx plugins to integrate the tools you use
with Nx. Running those tools through Nx will have caching enabled when possible, providing you with a faster alternative
for running those tools. You can start with a few to see how it works and then add more with
the [`nx add`](/nx-api/nx/documents/add) command later. You can also decide to add them all and get the full experience
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
+   "nx": {}
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
configuring the plugins on the [`@nx/next/plugin`](/nx-api/next) and [`@nx/eslint/plugin`](/nx-api/eslint) plugin pages.

To view all available tasks, open the Project Details view with Nx Console or use the terminal to launch the project
details in a browser window.

```shell
nx show project my-workspace --web
```

{% project-details title="Project Details View" height="100px" %}

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
            "command": "next dev"
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
            "command": "next start"
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

## Set Up CI for Your Workspace

This tutorial walked you through how Nx can improve the local development experience, but the biggest difference Nx makes is in CI. As repositories get bigger, making sure that the CI is fast, reliable and maintainable can get very challenging. Nx provides a solution.

- Nx reduces wasted time in CI with the [`affected` command](/ci/features/affected).
- Nx Replay's [remote caching](/ci/features/remote-cache) will reuse task artifacts from different CI executions making sure you will never run the same computation twice.
- Nx Agents [efficiently distribute tasks across machines](/ci/concepts/parallelization-distribution) ensuring constant CI time regardless of the repository size. The right number of machines is allocated for each PR to ensure good performance without wasting compute.
- Nx Atomizer [automatically splits](/ci/features/split-e2e-tasks) large e2e tests to distribute them across machines. Nx can also automatically [identify and rerun flaky e2e tests](/ci/features/flaky-tasks).

### Generate a CI Workflow

If you are starting a new project, you can use the following command to generate a CI workflow file.

```shell
npx nx generate ci-workflow --ci=github
```

{% callout type="note" title="Choose your CI provider" %}
You can choose `github`, `circleci`, `azure`, `bitbucket-pipelines`, or `gitlab` for the `ci` flag.
{% /callout %}

This generator creates a `.github/workflows/ci.yml` file that contains a CI pipeline that will run the `lint`, `test`, `build` and `e2e` tasks for projects that are affected by any given PR.

The key line in the CI pipeline is:

```yml
- run: npx nx affected -t lint test build e2e-ci
```

### Connect to Nx Cloud

Nx Cloud is a companion app for your CI system that provides remote caching, task distribution, e2e tests deflaking, better DX and more.

To connect to Nx Cloud:

- Commit and push your changes
- Go to [https://cloud.nx.app](https://cloud.nx.app), create an account, and connect your repository

#### Connect to Nx Cloud Manually

If you are not able to connect via the automated process at [https://cloud.nx.app](https://cloud.nx.app), you can connect your workspace manually by running:

```shell
npx nx connect
```

You will then need to merge your changes and connect to your workspace on [https://cloud.nx.app](https://cloud.nx.app).

### Enable a Distributed CI Pipeline

The current CI pipeline runs on a single machine and can only handle small workspaces. To transform your CI into a CI that runs on multiple machines and can handle workspaces of any size, uncomment the `npx nx-cloud start-ci-run` line in the `.github/workflows/ci.yml` file.

```yml
- run: npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js" --stop-agents-after="e2e-ci"
```

For more information about how Nx can improve your CI pipeline, check out one of these detailed tutorials:

- [Circle CI with Nx](/ci/intro/tutorials/circle)
- [GitHub Actions with Nx](/ci/intro/tutorials/github-actions)

## Learn More

{% cards %}

{% card title="Customizing Inputs and Named Inputs" description="Learn more about how to fine-tune caching with custom
inputs" type="documentation" url="/recipes/running-tasks/configure-inputs" /%}

{% card title="Cache Task Results" description="Learn more about how caching works" type="documentation" url="
/features/cache-task-results" /%}

{% card title="Adding Nx to NPM/Yarn/PNPM Workspace" description="Learn more about how to add Nx to an existing
monorepo" type="documentation" url="/recipes/adopting-nx/adding-to-monorepo" /%}

{% /cards %}

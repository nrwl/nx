# Adding Nx to NPM/Yarn/PNPM Workspace

{% callout type="note" title="Migrating from Lerna?" %}
Interested in migrating from [Lerna](https://github.com/lerna/lerna) in particular? In case you missed it, Lerna v6 is powering Nx underneath. As a result, Lerna gets all the modern features such as caching and task pipelines. Read more on [https://lerna.js.org/upgrade](https://lerna.js.org/upgrade).
{% /callout %}

Nx has first-class support for [monorepos](/getting-started/tutorials/package-based-repo-tutorial). As a result, if you have an existing NPM/Yarn or PNPM-based monorepo setup, you can easily add Nx to get

- fast [task scheduling](/features/run-tasks)
- support for [task pipelines](/concepts/task-pipeline-configuration)
- [caching](/features/cache-task-results)
- [remote caching with Nx Cloud](/ci/features/remote-cache)
- [distributed task execution with Nx Cloud](/ci/features/distribute-task-execution)

This is a low-impact operation because all that needs to be done is to install the `nx` package at the root level and add an `nx.json` for configuring caching and task pipelines.

{% youtube
src="https://www.youtube.com/embed/ngdoUQBvAjo"
title="Add Nx to a PNPM workspaces monorepo"
width="100%" /%}

## Installing Nx

Run the following command to automatically set up Nx:

```shell
npx nx@latest init
```

This will set up Nx for you - updating the `package.json` file and creating a new `nx.json` file with Nx configuration based on your answers during the set up process. The set up process will suggest installing Nx plugins that might be useful based on your existing repository. The example below is using the `@nx/eslint` and `@nx/next` plugins to run ESLint and Next.js tasks with Nx:

```json {% fileName="nx.json" %}
{
  "plugins": [
    {
      "plugin": "@nx/eslint/plugin",
      "options": {
        "targetName": "lint"
      }
    },
    {
      "plugin": "@nx/next/plugin",
      "options": {
        "buildTargetName": "build",
        "devTargetName": "dev",
        "startTargetName": "start"
      }
    }
  ]
}
```

When Nx updates your `package.json` scripts, it looks for scripts that can be replaced with an Nx command that has caching automatically enabled. The `package.json` defined above would be updated to look like this:

```json {% fileName="package.json" %}
{
  "name": "my-workspace",
  ...
  "scripts": {
    "build": "nx build",
    "lint": "nx lint",
    "test": "node ./run-tests.js"
  },
  ...
  "nx": {
    "includedScripts": []
  }
}
```

The `@nx/next` plugin can run `next build` for you and set up caching correctly, so it replaces `next build` with `nx build`. Similarly, `@nx/eslint` can set up caching for `eslint ./src`. When you run `npm run build` or `npm run lint` multiple times, you'll see that caching is enabled. You can also call Nx directly from the terminal with `nx build` or `nx lint`.

The `test` script was not recognized by any Nx plugin, so it was left as is.

The `includedScripts` array allows you to specify `package.json` scripts that can be run with the `nx build` syntax.

## Inferred Tasks

You may have noticed that `@nx/next` provides `dev` and `start` tasks in addition to the `build` task. Those tasks were created by the `@nx/next` plugin from your existing Next.js configuration. To view all available tasks, open the Project Details view with Nx Console or use the terminal to launch the project details in a browser window.

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
        "lint": {
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
          "configurations": {}
        },
        "build": {
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
          "configurations": {}
        },
        "dev": {
          "options": {
            "cwd": ".",
            "command": "next dev"
          },
          "executor": "nx:run-commands",
          "configurations": {}
        },
        "start": {
          "options": {
            "cwd": ".",
            "command": "next start"
          },
          "dependsOn": ["build"],
          "executor": "nx:run-commands",
          "configurations": {}
        }
      },
      "sourceRoot": ".",
      "name": "my-workspace",
      "projectType": "library",
      "includedScripts": [],
      "implicitDependencies": [],
      "tags": []
    }
  },
  "sourceMap": {
    "root": ["package.json", "nx/core/package-json-workspaces"],
    "targets": ["package.json", "nx/core/package-json-workspaces"],
    "targets.lint": ["package.json", "@nx/eslint/plugin"],
    "targets.lint.command": ["package.json", "@nx/eslint/plugin"],
    "targets.lint.cache": ["package.json", "@nx/eslint/plugin"],
    "targets.lint.options": ["package.json", "@nx/eslint/plugin"],
    "targets.lint.inputs": ["package.json", "@nx/eslint/plugin"],
    "targets.lint.options.cwd": ["package.json", "@nx/eslint/plugin"],
    "targets.build": ["next.config.js", "@nx/next/plugin"],
    "targets.build.command": ["next.config.js", "@nx/next/plugin"],
    "targets.build.options": ["next.config.js", "@nx/next/plugin"],
    "targets.build.dependsOn": ["next.config.js", "@nx/next/plugin"],
    "targets.build.cache": ["next.config.js", "@nx/next/plugin"],
    "targets.build.inputs": ["next.config.js", "@nx/next/plugin"],
    "targets.build.outputs": ["next.config.js", "@nx/next/plugin"],
    "targets.build.options.cwd": ["next.config.js", "@nx/next/plugin"],
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
    "includedScripts": ["package.json", "nx/core/package-json-workspaces"],
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

The project detail view lists all available tasks, the configuration values for those tasks and where those configuration values are being set.

## Configure an Existing Script to Run with Nx

If you want to run one of your existing scripts with Nx, you need to tell Nx about it.

1. Preface the script with `nx exec -- ` to have `npm run test` invoke the command with Nx.
2. Add the script to `includedScripts`.
3. Define caching settings.

The `nx exec` command allows you to keep using `npm test` or `npm run test` (or other package manager's alternatives) as you're accustomed to. But still get the benefits of making those operations cacheable. Configuring the `test` script from the example above to run with Nx would look something like this:

```json {% fileName="package.json" %}
{
  "name": "my-workspace",
  ...
  "scripts": {
    "build": "nx build",
    "lint": "nx lint",
    "test": "nx exec -- node ./run-tests.js"
  },
  ...
  "nx": {
    "includedScripts": ["test"],
    "targets": {
      "test": {
        "cache": "true",
        "inputs": ["default", "^default"],
        "outputs": []
      }
    }
  }
}
```

Now if you run `npm run test` or `nx test` twice, the results will be retrieved from the cache. The `inputs` used in this example are as cautious as possible, so you can significantly improve the value of the cache by [customizing Nx Inputs](/recipes/running-tasks/configure-inputs) for each task.

## Incrementally Adopting Nx

All the features of Nx can be enabled independently of each other. Hence, Nx can easily be adopted incrementally by initially using Nx just for a subset of your scripts and then gradually adding more.

For example, use Nx to run your builds:

```shell
npx nx run-many -t build
```

But instead keep using NPM/Yarn/PNPM workspace commands for your tests and other scripts. Here's an example of using PNPM commands to run tests across packages

```shell
pnpm run -r test
```

This allows for incrementally adopting Nx in your existing workspace.

## Learn More

{% cards %}

{% card title="Cache Task Results" description="Learn more about how caching works" type="documentation" url="/features/cache-task-results" /%}

{% card title="Task Pipeline Configuration" description="Learn more about how to setup task dependencies" type="documentation" url="/concepts/task-pipeline-configuration" /%}

{% card title="Nx Ignore" description="Learn about how to ignore certain projects using .nxignore" type="documentation" url="/reference/nxignore" /%}

{% card title="Nx and Turbo" description="Read about how Nx compares to Turborepo" url="/concepts/more-concepts/turbo-and-nx" /%}

{% card title="Integrated Repos vs Package-Based Repos" description="Learn about two styles of monorepos." url="/concepts/integrated-vs-package-based" /%}

{% /cards %}

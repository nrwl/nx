# Adding Nx to NPM/Yarn/PNPM Workspace

{% callout type="note" title="Migrating from Lerna?" %}
Interested in migrating from [Lerna](https://github.com/lerna/lerna) in particular? In case you missed it, Lerna v6 is powering Nx underneath. As a result, Lerna gets all the modern features such as caching and task pipelines. Read more on [https://lerna.js.org/upgrade](https://lerna.js.org/upgrade).
{% /callout %}

Nx has first-class support for [package-based monorepos](/getting-started/tutorials/package-based-repo-tutorial). As a result, if you have an existing NPM/Yarn or PNPM-based monorepo setup, you can easily add Nx to get

- fast [task scheduling](/core-features/run-tasks)
- support for [task pipelines](/concepts/task-pipeline-configuration)
- [caching](/core-features/cache-task-results)
- optionally [remote caching with Nx Cloud](/core-features/share-your-cache)
- optionally [distributed task execution with Nx Cloud](/core-features/distribute-task-execution)

This is a low-impact operation because all that needs to be done is to install the `nx` package at the root level and add an `nx.json` for configuring caching and task pipelines.

## Installing Nx

Run the following command to automatically set up Nx:

```shell
npx nx@latest init
```

Running this command will

- collect all the NPM scripts in the corresponding `package.json` files of your workspace packages
- ask you which of those scripts are cacheable (e.g. build, test, lint)
- ask you which of those scripts might need to be run in a certain order (e.g. if you run the `build` script you might want to first build all the dependent projects)
- ask you for custom output folders that should be captured as part of the caching

This process adds `nx` to your `package.json` at the root of your workspace:

```json {% fileName="package.json" %}
{
  "name": "my-workspace",
  ...
  "devDependencies": {
    ...
    "nx": "15.3.0"
  }
}
```

It also creates a `nx.json` based on the answers given during the setup process. This includes cacheable operations as well as some initial definition of the task pipeline. Here is an example:

```json {% fileName="nx.json" %}
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "test", "lint"]
      }
    }
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Incrementally Adopting Nx

In a package-based monorepo, Nx only manages the scheduling and caching of your npm scripts. Hence, it can easily be adopt incrementally by initially using Nx just for a subset of your scripts and then gradually adding more.

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

{% card title="Cache Task Results" description="Learn more about how caching works" type="documentation" url="/core-features/cache-task-results" /%}

{% card title="Task Pipeline Configuration" description="Learn more about how to setup task dependencies" type="documentation" url="/concepts/task-pipeline-configuration" /%}

{% card title="Nx Ignore" description="Learn about how to ignore certain projects using .nxignore" type="documentation" url="/reference/nxignore" /%}

{% card title="Nx and Turbo" description="Read about how Nx compares to Turborepo" url="/more-concepts/turbo-and-nx" /%}

{% card title="Nx and Lerna" description="Read about how Nx and Lerna can be used together" url="/recipes/adopting-nx/lerna-and-nx" /%}

{% card title="Integrated Repos vs Package-Based Repos" description="Learn about two styles of monorepos." url="/concepts/integrated-vs-package-based" /%}

{% /cards %}

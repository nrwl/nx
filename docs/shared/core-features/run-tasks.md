# Run Tasks

Monorepos can have hundreds or even thousands of projects, so being able to run actions against all (or some) of
them is a key feature of a tool like Nx.

## Definitions

- **Command -** anything the developer types into the terminal (e.g., `nx run header:build`).
- **Target -** the name of an action taken on a project (e.g., `build`)
- **Task -** an invocation of a target on a specific project (e.g., `header:build`).

## Define Tasks

For these examples, we'll imagine a repo that has three projects: `myapp`, `header` and `footer`. `myapp` is a deployable app and uses the `header` and `footer` libraries.

Each project has the `test` and `build` targets defined. Tasks can be defined as npm scripts in a project's `package.json` file or as targets in a `project.json` file:

{% tabs %}
{% tab label="package.json" %}

```json {% fileName="package.json" %}
{
  "scripts": {
    "build": "webpack -c webpack.conf.js",
    "test": "jest --coverage"
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json {% fileName="project.json" %}
{
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "webpack -c webpack.conf.js"
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "codeCoverage": true
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

## Running Tasks

Nx uses the following syntax:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Run a Single Task

To run the `test` target on the `header` project run this command:

```shell
npx nx test header
```

### Run Tasks for Multiple Projects

you can use the `run-many` command to run a task for multiple projects. Here are a couple of examples.

Run the `build` target for all projects in the repo:

```shell
npx nx run-many -t build
```

Run the `build`, `lint` and `test` target for all projects in the repo:

```shell
npx nx run-many -t build lint test
```

Run the `build`, `lint` and `test` target just on the `header` and `footer` projects:

```shell
npx nx run-many -t build lint test -p header footer
```

Note that Nx parallelizes all these tasks making also sure they are run in the right order based on their dependencies and the [task pipeline configuration](/concepts/task-pipeline-configuration).

Learn more about the [run-many](/packages/nx/documents/run-many) command.

### Run Tasks on Projects Affected by a PR

You can also run a command for all the projects affected by your PR like this:

```shell
npx nx affected -t test
```

Learn more about the affected command [here](/concepts/affected).

## Run Root-Level Tasks

Sometimes you have tasks that apply to the entire codebase rather than to a single project. But you still want those tasks to go through the "Nx pipeline" in order to benefit from caching. You can define these in the root-level `package.json` as follows:

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "scripts": {
    "docs": "node ./generateDocsSite.js"
  },
  "nx": {}
}
```

> Note the `nx: {}` property on the `package.json`. This is necessary to inform Nx about this root-level project. The property can also be expanded to specify cache inputs and outputs.

To invoke it, use:

```shell
npx nx docs
```

If you want Nx to cache the task, but prefer to use npm (or pnpm/yarn) to run the script (i.e. `npm run docs`) you can use the [nx exec](/packages/nx/documents/exec) command:

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "scripts": {
    "docs": "nx exec -- node ./generateDocsSite.js"
  },
  "nx": {}
}
```

Learn more about root-level tasks [in our dedicated recipe page](/recipes/other/root-level-scripts).

## Defining the Task Pipeline

In a monorepo you might need to define the order with which the tasks are being run. For example, if project `app` depends on `header` you might want to run the `build` target on `header` before running the `build` target on `app`.

Nx automatically understands these dependencies but you can configure for which targets such ordering needs to be respected by defining them in the `nx.json`:

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

Learn more about it in the [Task Pipeline Configuration](/concepts/task-pipeline-configuration).

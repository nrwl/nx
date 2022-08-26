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

```json
{
  "scripts": {
    "build": "webpack -c webpack.conf.js",
    "test": "jest --coverage"
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json
{
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": {
        "command": "webpack -c webpack.conf.js"
      }
    },
    "test": {
      "executor": "@nrwl/jest:jest",
      "options": {
        "codeCoverage": true
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

## Run a Single Task

To run the `test` target on the `header` project run this command:

```bash
npx nx test header
```

## Run Everything

To run the `build` target for all projects in the repo, run:

```bash
npx nx run-many --target=build
```

This will build the projects in the right order: `footer` and `header` and then `myapp`.

```bash title="Terminal Output"
    ✔  nx run header:build (501ms)
    ✔  nx run footer:build (503ms)
    ✔  nx run myapp:build (670ms)

 —————————————————————————————————————————————————————————————————————————————

 >  NX   Successfully ran target build for 3 projects (1s)
```

Note that Nx doesn't care what each of the build scripts does. The name `build` is also **not** special: it's simply
the name of the target.

## Run Tasks Affected by a PR

You can also run a command for all the projects affected in your PR like this:

```bash
npx nx affected --target=test
```

Learn more about the affected command [here](/concepts/affected).

## Control How Tasks Run

For more control over the order tasks are executed, edit the [Task Pipeline Configuration](../concepts/task-pipeline-configuration).

To speed up your task execution, learn how to [Cache Task Results](./cache-task-results) and [Distribute Task Execution](./distribute-task-execution)

## Related Documentation

### Concepts

- [Task Pipeline Configuration](/concepts/task-pipeline-configuration)
- [How Affected Works](/concepts/affected)

### Reference

- [run command](/nx/run)
- [run-many command](/nx/run-many)
- [affected command](/nx/affected)

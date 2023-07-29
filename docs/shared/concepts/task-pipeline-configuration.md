# Task Pipeline Configuration

Nx runs tasks in the most efficient way possible. The `nx.json` file is the place where you can configure how Nx does it.

## Run Tasks in Parallel

If you want to increase the number of processes running tasks to, say, 5 (by default, it is 3), pass the
following:

```shell
npx nx build myapp --parallel=5
```

Note, you can also change the default in `nx.json`, like this:

```json {% fileName="nx.json"%}
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": [],
        "parallel": 5
      }
    }
  }
}
```

## Define Task Dependencies (aka Task Pipelines)

To ensure tasks run in the correct order, Nx needs to know how the tasks depend on each other. Add the following to `nx.json`:

```jsonc {% fileName="nx.json"%}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

With this, Nx knows that before it can build a project, it needs to build all of its dependencies first. There are, however, no constraints on tests.

This mechanism is very flexible. Let's look at this example:

```jsonc {% fileName="nx.json"%}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build", "prebuild"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

> Note, older versions of Nx used targetDependencies instead of targetDefaults. `targetDependencies` was removed in version 16, with `targetDefaults` replacing its use case.

When running `nx test myproj`, the above configuration would tell Nx to

1. Run the `test` command for `myproj`
2. But since there's a dependency defined from `test -> build` (see `test:["build"]`), Nx runs `build` for `myproj`
   first.
3. `build` itself defines a dependency on `prebuild` (on the same project) as well as `build` of all the dependencies.
   Therefore, it will run the `prebuild` script and will run the `build` script for all the dependencies.

Note, Nx doesn't have to run all builds before it starts running tests. The task orchestrator will run as many tasks
in parallel as possible as long as the constraints are met.

Situations like this are pretty common:

![task-graph-execution](/shared/mental-model/task-graph-execution.svg)

Because we described the rules in `nx.json`, they will apply to all the projects in the repo. You can also define
project-specific rules by adding them to the project's configuration ([learn more](/reference/project-configuration#dependson).

```jsonc {% fileName="package.json"%}
{
  ...
  "nx": {
    "targets": {
      "test": {
        "dependsOn": [
          "build"
        ]
      }
    }
  }
}
```

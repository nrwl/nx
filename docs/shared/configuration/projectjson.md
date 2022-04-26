# Project Configuration: project.json

There are two main types of configuration in every Nx workspace: [project configuration](#project-configuration)
and [workspace defaults and Nx CLI configuration](workspace-defaults-and-cli).

> This guide covers project configuration, to learn about workspace defaults and Nx CLI configuration you can check out [/configuration/workspace-defaults-and-cli](workspace-defaults-and-cli)

Projects can be configured in `package.json` (if you use npm scripts and not Nx executors) and `project.json` (if you
use Nx executors). Both `package.json` and `project.json` files are located in each project's folder. Nx merges the two
files to get each project's configuration. This guide covers the `project.json` case.

> Angular developers can also configure projects in angular.json. Read [this guide](/getting-started/nx-and-angular#angularjson) for more information.

## Project Configuration

The `project.json` file contains configuration specific to its project. This file is often created when you use Nx
Plugins. It configures custom executors, which are used instead of npm scripts. Custom executors are typed, toolable and provide a
lot more flexibility for running long-live processes. They are also more composable.

If you're satisfied with npm scripts though, you will never see a `project.json` file in your workspace. But we encourage
you to explore Nx Plugins and the power they bring.

Let's look at the following `project.json`:

```json
{
  "root": "libs/mylib/",
  "sourceRoot": "libs/mylib/src",
  "projectType": "library",
  "targets": {
    "test": {
      "executor": "@nrwl/jest:jest",
      "outputs": [],
      "dependsOn": [
        {
          "target": "build",
          "projects": "self"
        }
      ],
      "options": {
        "jestConfig": "libs/mylib/jest.config.js",
        "tsConfig": "libs/mylib/tsconfig.spec.json"
      }
    },
    "build": {
      "executor": "@nrwl/js:tsc",
      "outputs": ["dist/libs/mylib"],
      "dependsOn": [
        {
          "target": "build",
          "projects": "dependencies"
        }
      ],
      "options": {
        "tsConfig": "libs/mylib/tsconfig.lib.json",
        "main": "libs/mylib/src/main.ts"
      },
      "configurations": {
        "production": {
          "tsConfig": "libs/mylib/tsconfig-prod.lib.json"
        }
      }
    }
  },
  "tags": ["scope:myteam"],
  "implicitDependencies": ["anotherlib"]
}
```

- `root` tells Nx the location of the library including its sources and configuration files.
- `sourceRoot` tells Nx the location of the library's source files.
- `projectType` is either 'application' or 'library'. The project type is used in project graph viz and in a few aux
  commands.

### Targets

Let's look at a sample test target:

```json
{
  "test": {
    "executor": "@nrwl/jest:jest",
    "outputs": [],
    "dependsOn": [
      {
        "target": "build",
        "projects": "self"
      }
    ],
    "options": {
      "jestConfig": "libs/mylib/jest.config.js",
      "tsConfig": "libs/mylib/tsconfig.spec.json"
    }
  }
}
```

**Target Name**

The name of the target `test` means that you can invoke it as follows: `nx test mylib` or `nx run mylib:test`. The name
isn't significant in any other way. If you rename it to, for example, `mytest`, you will be able to run as
follows: `nx mytest mylib` or `nx run mylib:mytest`.

**Executor**

The `executor` property tells Nx what function to invoke when you run the target. `"@nrwl/jest:jest"` tells Nx to find
the `@nrwl/jest` package, find the executor named `jest` and invoke it with the options.

**Options**

The `options` provides a map of values that will be passed to the executor. The provided command line args will be
merged into this map. I.e., `nx test mylib --jestConfig=libs/mylib/another-jest.config.js` will pass the following to
the executor:

```json
{
  "jestConfig": "libs/mylib/another-jest.config.js",
  "tsConfig": "libs/mylib/tsconfig.spec.json"
}
```

**Configurations**

The `configurations` property provides extra sets of values that will be merged into the options map.

```json
{
  "build": {
    "executor": "@nrwl/js:tsc",
    "outputs": ["dist/libs/mylib"],
    "dependsOn": [
      {
        "target": "build",
        "projects": "dependencies"
      }
    ],
    "options": {
      "tsConfig": "libs/mylib/tsconfig.lib.json",
      "main": "libs/mylib/src/main.ts"
    },
    "configurations": {
      "production": {
        "tsConfig": "libs/mylib/tsconfig-prod.lib.json"
      }
    }
  }
}
```

You can select a configuration like this: `nx build mylib --configuration=production`
or `nx run mylib:build:configuration=production`.

The following code snippet shows how the executor options get constructed:

```javascript
require(`@nrwl/jest`).executors['jest']({
  ...options,
  ...selectedConfiguration,
  ...commandLineArgs,
}); // Pseudocode
```

The selected configuration adds/overrides the default options, and the provided command line args add/override the
configuration options.

### Outputs

`"outputs": ["dist/libs/mylib"]` tells Nx where the `build` target is going to create file artifacts. The provided value
is actually the default, so we can omit it in this case. `"outputs": []` tells Nx that the `test` target doesn't create
any artifacts on disk.

### dependsOn

Targets can depend on other targets.

A common scenario is having to build dependencies of a project first before building the project. This is what
the `dependsOn` property of the `build` target configures. It tells Nx that before it can build `mylib` it needs to make
sure that `mylib`'s dependencies are built as well. This doesn't mean Nx is going to rerun those builds. If the right
artifacts are already in the right place, Nx will do nothing. If they aren't in the right place, but they are available
in the cache, Nx will retrieve them from the cache.

Another common scenario is for a target to depend on another target of the same project. For instance, `dependsOn` of
the `test` target tells Nx that before it can test `mylib` it needs to make sure that `mylib` is built, which will
result in `mylib`'s dependencies being built as well.

This configuration is usually not needed. Nx comes with reasonable defaults [(imported in `nx.json`)](workspace-defaults-and-cli) which implement the
configuration above.

### tags

You can annotate your projects with `tags` as follows:

```jsonc
{
  "tags": ["scope:myteam"]
}
```

You can [configure lint rules using these tags](/structure/monorepo-tags) to, for instance, ensure that libraries belonging to `myteam` are not depended on by libraries belong to `theirteam`.

### implicitDependencies

Nx uses powerful source-code analysis to figure out your workspace's project graph. Some dependencies cannot be deduced
statically, so you can set them manually like this:

```json
{
  "root": "libs/mylib/",
  "sourceRoot": "libs/mylib/src",
  "projectType": "library",
  "targets": {},
  "implicitDependencies": ["anotherlib"]
}
```

You can also remove a dependency as follows:

```jsonc
{
  "root": "libs/mylib/",
  "sourceRoot": "libs/mylib/src",
  "projectType": "library",
  "targets": {},
  "implicitDependencies": ["!anotherlib"] # regardless of what Nx thinks, "mylib" doesn't depend on "anotherlib"
}
```

### workspace json

The `workspace.json` file in the root directory is optional. It's used if you want to list the projects in your workspace explicitly instead of Nx scanning the file tree for all `project.json` and `package.json` files.

```json
{
  "version": 2,
  "projects": {
    "myapp": "apps/myapp"
  }
}
```

- `"version": 2` tells Nx that we are using Nx's format for the `workspace.json` file.
- `projects` is a map of project names to their locations.

You could inline `project.json` files into `workspace.json`. This used to be the default, but it's no longer
recommended. If you have an existing workspace where the configuration is inlined,
run `nx g convert-to-nx-project --all`.

If you have an old workspace where the configuration version is set to 1, change the version number to 2 and
run `nx format`.

## Validating the configuration

If at any point in time you want to check if your configuration is in sync, you can use
the [workspace-lint](/cli/workspace-lint) executor:

```bash
nx workspace-lint
```

This will identify any projects with no files in the configured project root folder, as well as any file that's not part
of any project configured in the workspace.

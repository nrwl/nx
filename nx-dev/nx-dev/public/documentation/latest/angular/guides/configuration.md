# Configuration

There are two main types of configuration in every Nx workspace: [project configuration](#project-configuration) and [workspace configuration](#workspace-configuration). Project configuration consists of `workspace.json`/`angular.json`, `**/project.json`, and `**/package.json`. Workspace configuration consists of `nx.json` and `tsconfig.base.json`.

Many Nx plugins modify these files when generating new code, but you can also modify them manually.

## Project Configuration

### workspace json / angular json

`workspace.json` is used in all Nx monorepos, regardless of framework. In repositories created from an existing angular project, the file
may be called `angular.json` instead. To transition, optionally rename the file.

Since `workspace.json` is used in most Nx repositories, we will refer to that from here on.

The `workspace.json` file contains a list of project configurations, as well as the version of your workspace. Let's look at the following example:

```json
{
  "version": 2,
  "projects": {
    "myapp": "apps/myapp"
  }
}
```

- `"version": 2` tells Nx that we are using Nx's format for the `workspace.json` file.
- `projects` is a map of project name to either the project location, or its configuration. (see [`project.json`](#project-json))

> This file is optional as of Nx v13.3.
> To convert an existing repository to use standalone configurations, run `nx g convert-to-nx-project --all`

#### Version 1 vs Version 2

- Version 1 workspaces do not support standalone configuration (`project.json` files), so all of the entries in projects are inline configurations.
- In Version 1 workspaces the `targets` property is replaced with `architect` in project configuration
- In Version 1 workspaces the `executor` property on a target is replaced with `executor`
- In Version 1 workspaces the `generators` property used to define generator defaults for a project is replaced with `schematics`

> To upgrade to version 2, change the version number to 2 and run `nx format`.

### project json

The `project.json` file contains configuration specific to it's project. Lets look at the following example:

```json
{
  "root": "libs/mylib/",
  "sourceRoot": "libs/mylib/src",
  "projectType": "library",
  "targets": {},
  "tags": [],
  "implicitDependencies": []
}
```

- `root` tells Nx the location of the library including its sources and configuration files.
- `sourceRoot` tells Nx the location of the library's source files.
- `projectType` is either 'application' or 'library'. The project type is used in dep graph viz and in a few aux commands.
- `architect` configures all the targets which define what tasks you can run against the library.
- `tags` configures tags used for linting
- `implicitDependencies` configure implicit dependencies between projects in the workspace ([see below](#implicit-dependencies))

The contents of `project.json` can be inlined into workspace.json by replacing the project location with the contents file. For example, in `workspace.json`, you could have something like:

```jsonc
{
  // ... other configuration
  "projects": {
    // ... other (poterntially standalone) projects
    "my-inline-project": {
      "root": "apps/my-inline-project"
      //... other project configuration
    }
  }
}
```

> In workspaces without `workspace.json` or `angular.json`, a `project.json` is optional for your project if it already has a `package.json`. Instead, its configuration is inferred based on its `package.json` as described below.

#### Targets

Let's look at a sample test target:

```json
{
  "test": {
    "executor": "@nrwl/jest:jest",
    "options": {
      "jestConfig": "libs/mylib/jest.config.js",
      "tsConfig": "libs/mylib/tsconfig.spec.json"
    }
  }
}
```

**Target Name**

The name of the target `test` means that you can invoke it as follows: `nx test mylib` or `nx run mylib:test`. The name isn't significant in any other way. If you rename it to, for example, `mytest`, you will be able to run as follows: `nx mytest mylib` or `nx run mylib:mytest`.

**Executor**

The `executor` property tells Nx what function to invoke when you run the target. `"@nrwl/jest:jest"` tells Nx to find the `@nrwl/jest` package, find the executor named `jest` and invoke it with the options.

**Options**

The `options` provides a map of values that will be passed to the executor. The provided command line args will be merged into this map. I.e., `nx test mylib --jestConfig=libs/mylib/another-jest.config.js` will pass the following to the executor:

```json
{
  "jestConfig": "libs/mylib/another-jest.config.js",
  "tsConfig": "libs/mylib/tsconfig.spec.json"
}
```

**Outputs**

The `outputs` property lists the folders the executor creates files in. The property is optional. If not provided, Nx assumes it is `dist/libs/mylib`.

```json
{
  "build": {
    "executor": "@nrwl/web:webpack",
    "outputs": ["dist/apps/myapp"],
    "options": {
      "index": "apps/myapp/src/app.html",
      "main": "apps/myapp/src/main.ts"
    }
  }
}
```

**Configurations**

The `configurations` property provides extra sets of values that will be merged into the options map.

```json
{
  "build": {
    "executor": "@nrwl/web:webpack",
    "outputs": ["dist/apps/myapp"],
    "options": {
      "index": "apps/myapp/src/app.html",
      "main": "apps/myapp/src/main.ts"
    },
    "configurations": {
      "production": {
        "optimization": true
      }
    }
  }
}
```

You can select a configuration like this: `nx build myapp --configuration=production` or `nx run myapp:build:configuration=production`.

The following show how the executor options get constructed:

```javascript
require(`@nrwl/jest`).executors['jest']({...options, ...selectedConfiguration, ...commandLineArgs}}) // Pseudocode
```

The selected configuration adds/overrides the default options, and the provided command line args add/override the configuration options.

**Target Dependencies**

Targets can depend on other targets. A common scenario is having to build dependencies of a project first before building the project. You can specify this using the `dependsOn`.

```json
{
  "build": {
    "executor": "@nrwl/web:webpack",
    "outputs": ["dist/apps/myapp"],
    "options": {
      "index": "apps/myapp/src/app.html",
      "main": "apps/myapp/src/main.ts"
    },
    "dependsOn": [
      {
        "target": "build",
        "projects": "dependencies"
      }
    ]
  }
}
```

In this case, running `nx build myapp` builds all the buildable libraries `myapp` depends on first. In other words, `nx build myapp` results in multiple tasks executing. The `--parallel` flag has the same effect as they would with `run-many` or `affected`.

It is also possible to define dependencies between the targets of the same project.

In the following example invoking `nx build myapp` builds all the libraries first, then `nx build-base myapp` is executed and only then `nx build myapp` is executed.

```json
{
  "build-base": {
    "executor": "@nrwl/web:webpack",
    "outputs": ["dist/apps/myapp"],
    "options": {
      "index": "apps/myapp/src/app.html",
      "main": "apps/myapp/src/main.ts"
    }
  },
  "build": {
    "executor": "@nrwl/workspace:run-commands",
    "dependsOn": [
      {
        "target": "build",
        "projects": "dependencies"
      },
      {
        "target": "build-base",
        "projects": "self"
      }
    ],
    "options": {
      "command": "./copy-readme-and-license.sh"
    }
  }
}
```

Often the same `dependsOn` configuration has to be defined for every project in the repo. You can define it once in `nx.json` (see below).

### package-json

Nx also infers additional project targets from scripts defined in it's `package.json` file, if it exists. For example, you may have a package.json in the root of your lib like this:

```jsonc
{
  "name": "@company/my-lib",
  "scripts": {
    "clean": "echo 1" // the actual command here is arbitrary
  }
}
```

This would lead to Nx being able to run the clean script, just like a target in `project.json`. You could run `nx clean my-lib` in this instance.

Targets inferred from `package.json` scripts are ran using the `@nrwl/workspace:run-script` executor, with the project's root as the current working directory.

> Targets inside `package.json` are overwritten if a target inside `project.json` has the same name.

Additional target configuration options such as those described in [targets](#targets) above can be defined for targets that are inferred from `package.json`. Here is an example for defining custom outputs to be able to cache an inferred test target:

```jsonc
{
  "name": "@company/my-lib",
  "scripts": {
    "test": "run-my-tests"
  },
  "nx": {
    "targets": {
      "test": {
        "outputs": ["packages/my-lib/coverage"]
      }
    }
  }
}
```

All of the options except `executor` are availble here.

## Workspace Configuration

### nx json

The `nx.json` file contains extra configuration options mostly related to the project graph.

```json
{
  "npmScope": "happyorg",
  "affected": {
    "defaultBase": "main"
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/workspace/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"]
      }
    }
  },
  "implicitDependencies": {
    "workspace.json": "*",
    "package.json": {
      "dependencies": "*",
      "devDependencies": "*"
    },
    "tsconfig.base.json": "*",
    "nx.json": "*"
  },
  "targetDependencies": {
    "build": [
      {
        "target": "build",
        "projects": "dependencies"
      }
    ]
  },
  "cli": {
    "defaultCollection": "@nrwl/web"
  }
}
```

**NPM Scope**

Tells Nx what prefix to use when generating library imports.

**Affected**

Tells Nx which branch and HEAD to use when calculating affected projects.

- `defaultBase` defines the default base branch, defaulted to `main`.

### Tasks Runner Options

Tasks runners are invoked when you run `nx test`, `nx build`, `nx run-many`, `nx affected`, and so on. The tasks runner named "default" is used by default. Specify a different one by passing `--runner`.

> A task is an invocation of a target.

Tasks runners can accept different options. The following are the options supported by `"@nrwl/workspace/tasks-runners/default"` and `"@nrwl/nx-cloud"`.

- `cacheableOperations` defines the list of targets/operations that are cached by Nx.
- `parallel` defines the max number of targets ran in parallel (in older versions of Nx you had to pass `--parallel --maxParallel=3` instead of `--parallel=3`)
- `captureStderr` defines whether the cache captures stderr or just stdout
- `skipNxCache` defines whether the Nx Cache should be skipped. Defaults to `false`
- `cacheDirectory` defines where the local cache is stored, which is `node_modules/.cache/nx` by default.
- `encryptionKey` (when using `"@nrwl/nx-cloud"` only) defines an encryption key to support end-to-end encryption of your cloud cache. You may also provide an environment variable with the key `NX_CLOUD_ENCRYPTION_KEY` that contains an encryption key as its value. The Nx Cloud task runner normalizes the key length, so any length of key is acceptable.
- `runtimeCacheInputs` defines the list of commands that are run by the runner to include into the computation hash value.
- `selectivelyHashTsConfig` only hash the path mapping of the active project in the `tsconfig.base.json` (e.g., adding/removing projects doesn't affect the hash of existing projects). Defaults to `false`

`runtimeCacheInputs` are set as follows:

```json
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/workspace/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"],
        "runtimeCacheInputs": ["node -v"]
      }
    }
  }
}
```

You can configure `parallel` in `nx.json`, but you can also pass them in the terminal `nx run-many --target=test --parallel=5`.

### Workspace Layout

You can add a `workspaceLayout` property to modify where libraries and apps are located.

```json
{
  "workspaceLayout": {
    "appsDir": "demos",
    "libsDir": "packages"
  }
}
```

These settings would store apps in `/demos/` and libraries in `/packages/`. The paths specified are relative to the workspace root.

### Implicit Dependencies

Nx performs advanced source-code analysis to figure out the project graph of the workspace. So when you make a change, Nx can deduce what can be broken by this change. Some dependencies between projects and dependencies between shared files and projects cannot be inferred statically. You can configure those using `implicitDependencies`.

```json
{
  "implicitDependencies": {
    "workspace.json": "*",
    "package.json": {
      "dependencies": "*",
      "devDependencies": {
        "mypackage": ["mylib"]
      },
      "scripts": {
        "check:*": "*"
      }
    },
    "globalFile": ["myapp"],
    "styles/**/*.css": ["myapp"]
  }
}
```

In the example above:

- Changing `workspace.json` affects every project.
- Changing the `dependencies` property in `package.json` affects every project.
- Changing the `devDependencies` property in `package.json` only affects `mylib`.
- Changing any of the custom check `scripts` in `package.json` affects every project.
- Changing `globalFile` only affects `myapp`.
- Changing any CSS file inside the `styles` directory only affects `myapp`.

You can also add dependencies between projects in [project configuration](#project-json). For instance, the example below defines a dependency from `myapp-e2e` to `myapp`, such that every time `myapp` is affected, `myapp-e2e` is affected as well.

```jsonc
{
  "projects": {
    "myapp": {
      //... other project config
      "tags": []
    },
    "myapp-e2e": {
      //... other project config
      "tags": [],
      "implicitDependencies": ["myapp"]
    }
  }
}
```

### Target Dependencies

Targets can depend on other targets. A common scenario is having to build dependencies of a project first before building the project. The `dependsOn` property in `workspace.json` can be used to define the list of dependencies of an individual target.

Often the same `dependsOn` configuration has to be defined for every project in the repo, and that's when defining `targetDependencies` in `nx.json` is helpful.

```json
{
  "targetDependencies": {
    "build": [
      {
        "target": "build",
        "projects": "dependencies"
      }
    ]
  }
}
```

The configuration above is identical to adding `{"dependsOn": [{"target": "build", "projects": "dependencies"]}` to every build target in `workspace.json`.

The `dependsOn` property in `workspace.json` takes precedence over the `targetDependencies` in `nx.json`.

### CLI Options

The following command generates a new library: `nx g @nrwl/angular:lib mylib`. After setting the `defaultCollection` property, the lib is generated without mentioning the collection name: `nx g lib mylib`.

```json
{
  "cli": {
    "defaultCollection": "@nrwl/angular"
  }
}
```

### Generators

Default generator options are configured in `nx.json` as well. For instance, the following tells Nx to always pass `--style=scss` when creating new libraries.

```json
{
  "generators": {
    "@nrwl/angular:library": {
      "style": "scss"
    }
  }
}
```

## nxignore

You may optionally add an `.nxignore` file to the root. This file is used to specify files in your workspace that should be completely ignored by Nx.

The syntax is the same as a [`.gitignore` file](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_ignoring).

**When a file is specified in the `.nxignore` file:**

1. Changes to that file are not taken into account in the `affected` calculations.
2. Even if the file is outside an app or library, `nx workspace-lint` won't warn about it.

## Keeping the configuration in sync

When creating projects, the Nx generators make sure these configuration files are updated accordingly for the new projects. While development continues and the workspace grows, you might need to refactor projects by renaming them, moving them to a different folder, removing them, etc. When this is done manually, you need to ensure your configuration files are kept in sync and that's a cumbersome task. Fortunately, Nx provides some generators and executors to help you with these tasks.

### Moving projects

Projects can be moved or renamed using the [@nrwl/angular:move](/{{framework}}/angular/move) generator.

For instance, if a library under the booking folder is now being shared by multiple apps, you can move it to the shared folder like this:

```bash
nx g @nrwl/angular:move --project booking-some-library shared/some-library
```

### Removing projects

Projects can be removed using the [@nrwl/workspace:remove](/{{framework}}/workspace/remove) generator.

```bash
nx g @nrwl/workspace:remove booking-some-library
```

### Validating the configuration

If at any point in time you want to check if your configuration is in sync, you can use the [workspace-lint]({{framework}}/cli/workspace-lint) executor:

```bash
nx workspace-lint
```

This will identify any projects with no files in the configured project root folder, as well as any file that's not part of any project configured in the workspace.

```

```

## Recent Changes

### v13-3-0

- `workspace.json` is now optional
  - projects can be inferred completely from `package.json` if `workspace.json` not present
- Targets are now merged from `package.json` instead of only being used if the project has no targets defined.
- Targets inferred from `package.json` can now have an extended configuration. See [above](#package-json)

### v13-0-0

Some settings were moved between `workspace.json`/`project.json` and `nx.json`.

- tags / implicit dependencies are no longer in `nx.json` were moved from `nx.json` to project configuration.
- `cli` and `defaultProject` moved to `nx.json` from `workspace.json`
- Non-project specific generator defaults in `workspace.json` via the `generators`/`schematics` property moved to `nx.json`

### v12-4-0

Standalone configuration and `project.json` introduced. See [above](#project-json)

- tags / implicit dependencies are no longer in `nx.json` for projects using `project.json`.

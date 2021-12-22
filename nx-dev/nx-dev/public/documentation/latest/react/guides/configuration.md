# Configuration

There are two main types of configuration in every Nx workspace: [project configuration](#project-configuration)
and [the global Nx CLI configuration](#cli-configuration).

Many Nx plugins modify these files when generating new code, but you can also modify them manually.

## Project Configuration

Project configuration is defined in the `package.json` and `project.json` files located in each project's folder. Nx
merges the two files to get each project's configuration.

If you don't use any Nx plugins, your project configuration will be defined in its `package.json`. If you use Nx
plugins, the relevant configuration will be defined in `project.json`.

### package json

Every npm script defined in `package.json` is a target you can invoke via Nx. For instance, if your project has the
following `package.json`:

```jsonc
{
  "name": "mylib",
  "scripts": {
    "test: "jest",
    "build": "tsc -p tsconfig.lib.json" // the actual command here is arbitrary
  }
}
```

you can invoke `nx clean mylib` or `nx test mylib` without any extra configuration.

You can add Nx-specific configuration as follows:

```jsonc
{
  "name": "mylib",
  "scripts": {
    "test: "jest",
    "build": "tsc -p tsconfig.lib.json" // the actual command here is arbitrary
  },
  "nx": {
    "targets": {
      "build": {
        "outputs": ["dist/libs/mylib"],
        "dependsOn": [
          {
            "target": "build",
            "projects": "dependencies"
          }
        ]
      }
    }
  }
}
```

This tells Nx that the `build` target of `mylib` depends on the same target of all `mylib`'s dependencies, so they
always have to be built first. It also tells Nx that the build is going to create files in `dist/libs/mylib`.

The configuration above is actually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which
implement the configuration above.

Another common thing is to define dependencies between targets of the same project:

```jsonc
{
  "name": "mylib",
  "scripts": {
    "test: "jest",
    "build": "tsc -p tsconfig.lib.json" // the actual command here is arbitrary
  },
  "nx": {
    "targets": {
      "test": {
        "dependsOn": {
          "target": "build",
          "projects": "self"
        }
      }
    }
  }
}
```

#### Adding Tags and Implicit Dependencies

```jsonc
{
  "name": "mylib",
  "nx": {
    "tags": ["scope:myteam"],
    "implicitDependencies": ["anotherlib"]
  }
}
```

- `tags` configures tags used for linting
- `implicitDependencies` configure implicit dependencies between projects in the
  workspace ([see below](#implicit-dependencies))

#### Ignoring a project

Nx will add every project with a `package.json` file in it to its project graph. If you want to ignore a particular
project, add the following to its `package.json`:

```jsonc
{
  "name": "mylib",
  "nx": {
    "ignore": true
  }
}
```

### project json

The `project.json` file contains configuration specific to its project. This file is often created when you use Nx
Plugins. Everything you can configure in `package.json` you can also configure in `project.json`. In addition, you can
configure custom executors, which are used instead of npm scripts. Custom executors are typed, toolable and provide a
lot more flexibility for running long-live processes. They are also more composable.

If you satisfied with npm scripts though, you will never see a `project.json` file in your workspace. But we encourage
you to explore Nx Plugins and the power they bring.

Let's look at the following `project.json`:

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
- `projectType` is either 'application' or 'library'. The project type is used in dep graph viz and in a few aux
  commands.
- `targets` configures all the targets which define what tasks you can run against the library.
- `tags` configures tags used for linting
- `implicitDependencies` configure implicit dependencies between projects in the
  workspace ([see below](#implicit-dependencies))

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

**Outputs**

The `outputs` property lists the folders the executor creates files in. The property is optional. If not provided, Nx
assumes it is `dist/app/myapp` or `dist/libs/mylib`.

```json
{
  "build": {
    "executor": "@nrwl/js:tsc",
    "outputs": ["dist/apps/myapp"],
    "options": {
      "tsConfig": "apps/myapp/tsconfig.app.json",
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
    "executor": "@nrwl/js:tsc",
    "outputs": ["dist/apps/myapp"],
    "options": {
      "tsConfig": "apps/myapp/tsconfig.app.json",
      "main": "apps/myapp/src/main.ts"
    },
    "configurations": {
      "production": {
        "tsConfig": "apps/myapp/tsconfig-prod.app.json"
      }
    }
  }
}
```

You can select a configuration like this: `nx build myapp --configuration=production`
or `nx run myapp:build:configuration=production`.

The following show how the executor options get constructed:

```javascript
require(`@nrwl/jest`).executors['jest']({ ...options, ...selectedConfiguration, ...commandLineArgs }
}) // Pseudocode
```

The selected configuration adds/overrides the default options, and the provided command line args add/override the
configuration options.

**Target Dependencies**

Targets can depend on other targets. A common scenario is having to build dependencies of a project first before
building the project. You can specify this using the `dependsOn`.

```json
{
  "build": {
    "executor": "@nrwl/js:tsc",
    "outputs": ["dist/apps/myapp"],
    "options": {
      "tsConfig": "apps/myapp/tsconfig.app.json",
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

In this case, running `nx build myapp` builds all the buildable libraries `myapp` depends on first. In other
words, `nx build myapp` results in multiple tasks executing. The `--parallel` flag has the same effect as they would
with `run-many` or `affected`.

It is also possible to define dependencies between the targets of the same project.

In the following example invoking `nx build myapp` builds all the libraries first, then `nx build-base myapp` is
executed and only then `nx build myapp` is executed.

```json
{
  "build-base": {
    "executor": "@nrwl/js:tsc",
    "outputs": ["dist/apps/myapp"],
    "options": {
      "tsConfig": "apps/myapp/tsconfig.app.json",
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

Often the same `dependsOn` configuration has to be defined for every project in the repo. You can define it once
in `nx.json` (see below).

### workspace json

The `workspace.json` is optional. It's used if you want to list the projects in your workspace explicitly instead of Nx
scanning the file tree for all `project.json` and `package.json` files.

```json
{
  "version": 2,
  "projects": {
    "myapp": "apps/myapp"
  }
}
```

- `"version": 2` tells Nx that we are using Nx's format for the `workspace.json` file.
- `projects` is a map of project name to either the project location, or its configuration. (
  see [`project.json`](#project-json))

You could inline `project.json` files into `workspace.json`. This used to be the default, but it's no longer
recommended. If you have an existing workspace where the configuration is inlined,
run `nx g convert-to-nx-project --all`.

If you have an old workspace where the configuration version is set to 1, change the version number to 2 and
run `nx format`.

## CLI Configuration

### nx json

The `nx.json` file contains extra configuration options mostly related to the project graph.

The following is an expanded version showing all options. Your `nx.json` will likely be much shorter.

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
  "workspaceLayout": {
    "appsDir": "demos",
    "libsDir": "packages"
  },
  "cli": {
    "defaultCollection": "@nrwl/js"
  }
}
```

**NPM Scope**

Tells Nx what prefix to use when generating library imports.

**Affected**

Tells Nx which branch and HEAD to use when calculating affected projects.

- `defaultBase` defines the default base branch, defaulted to `main`.

### Tasks Runner Options

Tasks runners are invoked when you run `nx test`, `nx build`, `nx run-many`, `nx affected`, and so on. The tasks runner
named "default" is used by default. Specify a different one by passing `--runner`.

> A task is an invocation of a target.

Tasks runners can accept different options. The following are the options supported
by `"@nrwl/workspace/tasks-runners/default"` and `"@nrwl/nx-cloud"`.

- `cacheableOperations` defines the list of targets/operations that are cached by Nx.
- `parallel` defines the max number of targets ran in parallel (in older versions of Nx you had to
  pass `--parallel --maxParallel=3` instead of `--parallel=3`)
- `captureStderr` defines whether the cache captures stderr or just stdout
- `skipNxCache` defines whether the Nx Cache should be skipped. Defaults to `false`
- `cacheDirectory` defines where the local cache is stored, which is `node_modules/.cache/nx` by default.
- `encryptionKey` (when using `"@nrwl/nx-cloud"` only) defines an encryption key to support end-to-end encryption of
  your cloud cache. You may also provide an environment variable with the key `NX_CLOUD_ENCRYPTION_KEY` that contains an
  encryption key as its value. The Nx Cloud task runner normalizes the key length, so any length of key is acceptable.
- `runtimeCacheInputs` defines the list of commands that are run by the runner to include into the computation hash
  value.
- `selectivelyHashTsConfig` only hash the path mapping of the active project in the `tsconfig.base.json` (e.g.,
  adding/removing projects doesn't affect the hash of existing projects). Defaults to `false`

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

You can configure `parallel` in `nx.json`, but you can also pass them in the
terminal `nx run-many --target=test --parallel=5`.

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

These settings would store apps in `/demos/` and libraries in `/packages/`. The paths specified are relative to the
workspace root.

### Implicit Dependencies

Nx performs advanced source-code analysis to figure out the project graph of the workspace. So when you make a change,
Nx can deduce what can be broken by this change. Some dependencies between projects and dependencies between shared
files and projects cannot be inferred statically. You can configure those using `implicitDependencies`.

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

You can also add dependencies between projects in [project configuration](#project-json). For instance, the example
below defines a dependency from `myapp-e2e` to `myapp`, such that every time `myapp` is affected, `myapp-e2e` is
affected as well.

```jsonc
{
  //... other project config
  "tags": [],
  "implicitDependencies": ["myapp"]
}
```

Finally, you can remove dependencies between projects. The following say even though the project imports 'mylib', it's
not a dependency Nx should be concerned with.

```jsonc
{
  //... other project config
  "tags": [],
  "implicitDependencies": ["!mylib"]
}
```

### Target Dependencies

Targets can depend on other targets. A common scenario is having to build dependencies of a project first before
building the project. The `dependsOn` property in `workspace.json` can be used to define the list of dependencies of an
individual target.

Often the same `dependsOn` configuration has to be defined for every project in the repo, and that's when
defining `targetDependencies` in `nx.json` is helpful.

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

The configuration above is identical to adding `{"dependsOn": [{"target": "build", "projects": "dependencies"]}` to
every build target in `workspace.json`.

The `dependsOn` property in `workspace.json` takes precedence over the `targetDependencies` in `nx.json`.

### CLI Options

The following command generates a new library: `nx g @nrwl/js:lib mylib`. After setting the `defaultCollection`property,
the lib is generated without mentioning the collection name: `nx g lib mylib`.

```json
{
  "cli": {
    "defaultCollection": "@nrwl/js"
  }
}
```

### Generators

Default generator options are configured in `nx.json` as well. For instance, the following tells Nx to always
pass `--buildable=true` when creating new libraries.

```json
{
  "generators": {
    "@nrwl/js:library": {
      "buildable": true
    }
  }
}
```

## nxignore

You may optionally add an `.nxignore` file to the root. This file is used to specify files in your workspace that should
be completely ignored by Nx.

The syntax is the same as
a [`.gitignore` file](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_ignoring).

**When a file is specified in the `.nxignore` file:**

1. Changes to that file are not taken into account in the `affected` calculations.
2. Even if the file is outside an app or library, `nx workspace-lint` won't warn about it.

## Keeping the configuration in sync

When creating projects, the Nx generators make sure these configuration files are updated accordingly for the new
projects. While development continues and the workspace grows, you might need to refactor projects by renaming them,
moving them to a different folder, removing them, etc. When this is done manually, you need to ensure your configuration
files are kept in sync and that's a cumbersome task. Fortunately, Nx provides some generators and executors to help you
with these tasks.

### Moving projects

Projects can be moved or renamed using the [@nrwl/workspace:move](/{{framework}}/workspace/move) generator.

For instance, if a library under the booking folder is now being shared by multiple apps, you can move it to the shared
folder like this:

```bash
nx g @nrwl/workspace:move --project booking-some-library shared/some-library
```

### Removing projects

Projects can be removed using the [@nrwl/workspace:remove](/{{framework}}/workspace/remove) generator.

```bash
nx g @nrwl/workspace:remove booking-some-library
```

### Validating the configuration

If at any point in time you want to check if your configuration is in sync, you can use
the [workspace-lint]({{framework}}/cli/workspace-lint) executor:

```bash
nx workspace-lint
```

This will identify any projects with no files in the configured project root folder, as well as any file that's not part
of any project configured in the workspace.

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
- Non-project specific generator defaults in `workspace.json` via the `generators`/`schematics` property moved
  to `nx.json`

### v12-4-0

Standalone configuration and `project.json` introduced. See [above](#project-json)

- tags / implicit dependencies are no longer in `nx.json` for projects using `project.json`.

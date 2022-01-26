# Configuration: package.json and nx.json

There are two main types of configuration in every Nx workspace: [project configuration](#project-configuration)
and [the global Nx CLI configuration](#cli-configuration).

Projects can be configured in `package.json` (if you use npm scripts and not Nx executors) and `project.json` (if you
use Nx executors). Both `package.json` and `project.json` files are located in each project's folder. Nx merges the two
files to get each project's configuration. This guide covers the `package.json` case.

## Project Configuration

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

you can invoke `nx build mylib` or `nx test mylib` without any extra configuration.

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
      },
      "test": {
        "outputs": [],
        "dependsOn": [
          {
            "target": "build",
            "projects": "self"
          }
        ]
      }
    }
  }
}
```

### outputs

`"outputs": ["dist/libs/mylib"]` tells Nx where the `build` target is going to create file artifacts. The provided value
is actually the default, so we can omit it in this case. `"outputs": []` tells Nx that the `test` target doesn't create
any artifacts on disk.

This configuration is usually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which implement the
configuration above.

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

This configuration is usually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which implement the
configuration above.

### tags

You can annotate your projects with `tags` as follows:

```jsonc
{
  "name": "mylib",
  "nx": {
    "tags": ["scope:myteam"]
  }
}
```

You can [configure lint rules using these tags](/structure/monorepo-tags) to, for instance, ensure that libraries belonging to `myteam` are not depended on by libraries belong to `theirteam`.

### implicitDependencies

Nx uses powerful source-code analysis to figure out your workspace's project graph. Some dependencies cannot be deduced
statically, so you can set them manually like this:

```jsonc
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["anotherlib"]
  }
}
```

You can also remove a dependency as follows:

```jsonc
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["!anotherlib"] # regardless of what Nx thinks, "mylib" doesn't depend on "anotherlib"
  }
}
```

### Ignoring a project

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

### workspace json

The `workspace.json` file in the root directory is optional. It's used if you want to list the projects in your workspace explicitly instead of Nx scanning the file tree for all `project.json` and `package.json` files that match the globs specified in the `workspaces` property of the root `package.json`.

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

## CLI Configuration

The `nx.json` file configures the Nx CLI and project defaults.

The following is an expanded version showing all options. Your `nx.json` will likely be much shorter.

```json
{
  "npmScope": "happyorg",
  "affected": {
    "defaultBase": "main"
  },
  "workspaceLayout": {
    "appsDir": "demos",
    "libsDir": "packages"
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
    "defaultCollection": "@nrwl/js"
  },
  "generators": {
    "@nrwl/js:library": {
      "buildable": true
    }
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "@nrwl/workspace/tasks-runners",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"]
      }
    }
  }
}
```

### NPM Scope

Tells Nx what prefix to use when generating library imports.

### Affected

Tells Nx which branch and HEAD to use when calculating affected projects.

- `defaultBase` defines the default base branch, defaulted to `main`.

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

### Files & Implicit Dependencies

Nx performs advanced source-code analysis to figure out the project graph of the workspace. So when you make a change,
Nx can deduce what can be broken by this change. Some dependencies between projects and shared files cannot be inferred
statically. You can configure those using `implicitDependencies`.

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
- Changing the `mypackage` property in `package.json` only affects `mylib`.
- Changing any of the custom check `scripts` in `package.json` affects every project.
- Changing `globalFile` only affects `myapp`.
- Changing any CSS file inside the `styles` directory only affects `myapp`.

### Target Dependencies

Targets can depend on other targets. A common scenario is having to build dependencies of a project first before
building the project. The `dependsOn` property in `package.json` can be used to define the list of dependencies of an
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
every build target of every project.

### CLI Options

The following command generates a new library: `nx g @nrwl/js:lib mylib`. After setting the `defaultCollection`property,
the lib is generated without mentioning the plugin name: `nx g lib mylib`.

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

### Tasks Runner Options

> A task is an invocation of a target.

Tasks runners are invoked when you run `nx test`, `nx build`, `nx run-many`, `nx affected`, and so on. The tasks runner
named "default" is used by default. Specify a different one like this `nx run-many --target=build --all --runner=another`.

Tasks runners can accept different options. The following are the options supported
by `"@nrwl/workspace/tasks-runners"` and `"@nrwl/nx-cloud"`.

- `cacheableOperations` defines the list of targets/operations that are cached by Nx.
- `parallel` defines the max number of targets ran in parallel (in older versions of Nx you had to
  pass `--parallel --maxParallel=3` instead of `--parallel=3`).
- `captureStderr` defines whether the cache captures stderr or just stdout.
- `skipNxCache` defines whether the Nx Cache should be skipped. Defaults to `false`.
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
      "runner": "@nrwl/workspace/tasks-runners",
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

## .nxignore

You may optionally add an `.nxignore` file to the root. This file is used to specify files in your workspace that should
be completely ignored by Nx.

The syntax is the same as
a [`.gitignore` file](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_ignoring).

**When a file is specified in the `.nxignore` file:**

1. Changes to that file are not taken into account in the `affected` calculations.
2. Even if the file is outside an app or library, `nx workspace-lint` won't warn about it.

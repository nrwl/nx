# Workspace defaults and CLI configuration: nx.json

The `nx.json` file configures the Nx CLI and workspace project defaults and will be fully functional out of the box based on your choices when running [`create-nx-workspace`](/getting-started/nx-setup)

> If you would like to learn more about configuring specific projects you can check out the guides on achieving this via either:
>
> - [project.json](projectjson) files
> - [package.json](packagejson) files

If you have an existing workspace with an `nx.json` file and would like an explanation of your specific configuration and what it does you can run:

```sh
# Explain the configuration found in the current workspace's nx.json
npx nx explain
```

### nx.json

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
      "runner": "nx/tasks-runners/default",
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
by `"nx/tasks-runners/default"` and `"@nrwl/nx-cloud"`.

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
      "runner": "nx/tasks-runners/default",
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

### Default Project

Default project. When project isn't provided, the default project will be used. Convenient for small workspaces with one main application.

### Extends

Optional (additional) Nx.json configuration file which becomes a base for this one.

### Plugins

Plugins for extending the project graph.

### Plugins Config

Configuration for Nx Plugins.

## .nxignore

You may optionally add an `.nxignore` file to the root. This file is used to specify files in your workspace that should
be completely ignored by Nx.

The syntax is the same as
a [`.gitignore` file](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_ignoring).

**When a file is specified in the `.nxignore` file:**

1. Changes to that file are not taken into account in the `affected` calculations.
2. Even if the file is outside an app or library, `nx workspace-lint` won't warn about it.

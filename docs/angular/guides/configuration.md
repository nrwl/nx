# Configuration

There are three top-level configuration files every Nx workspace has: `angular.json`, `nx.json`, and `tsconfig.json`. Many Nx plugins will modify these files when generating new code, but you can also modify them manually.

## angular.json

The `angular.json` configuration file contains information about the targets and schematics. Let's look at the following example:

```json
{
  "projects": {
    "myapp": {
      "root": "apps/myapp/",
      "sourceRoot": "apps/myapp/src",
      "projectType": "application",
      "architect": {
        "build": {
          "builder": "@nrwl/web:build",
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
        },
        "serve": {
          "builder": "@nrwl/web:dev-server",
          "options": {
            "buildTarget": "myapp:build",
            "proxyConfig": "apps/myapp/proxy.conf.json"
          }
        },
        "test": {
          "builder": "@nrwl/jest:jest",
          "options": {
            "jestConfig": "apps/myapp/jest.config.js",
            "tsConfig": "apps/myapp/tsconfig.spec.json"
          }
        }
      }
    },
    "mylib": {
      "root": "libs/mylib/",
      "sourceRoot": "libs/mylib/src",
      "projectType": "library",
      "architect": {
        "test": {
          "builder": "@nrwl/jest:jest",
          "options": {
            "jestConfig": "libs/mylib/jest.config.js",
            "tsConfig": "libs/mylib/tsconfig.spec.json"
          }
        }
      }
    }
  },
  "cli": {
    "defaultCollection": "@nrwl/web"
  }
}
```

### Projects

The `projects` property configures all apps and libs.

For instance, the following configures `mylib`.

```json
{
  "mylib": {
    "root": "libs/mylib/",
    "sourceRoot": "libs/mylib/src",
    "projectType": "library",
    "architect": {}
  }
}
```

- `root` tells Nx the location of the library including its sources and configuration files.
- `sourceRoot` tells Nx the location of the library's source files.
- `projectType` is either 'application' or 'library'.
- `architect` configures all the targets which define what tasks you can run against the library.

> Nx uses the architect library built by the Angular team at Google. The naming reflects that. Important to note: it's a general purpose library that **does not** have any dependency on Angular.

### Targets

Let's look at the simple architect target:

```json
{
  "test": {
    "builder": "@nrwl/jest:jest",
    "options": {
      "jestConfig": "libs/mylib/jest.config.js",
      "tsConfig": "libs/mylib/tsconfig.spec.json"
    }
  }
}
```

**Target Name**

The name of the target `test` means that you can invoke it as follows: `nx test mylib` or `nx run mylib:test`. The name isn't significant in any other way. If you rename it to, for example, `mytest`, you will be able to run as follows: `nx run mylib:mytest`.

**Builder**

The `builder` property tells Nx what function to invoke when you run the target. `"@nrwl/jest:jest"` tells Nx to find the `@nrwl/jest` package, find the builder named `jest` and invoke it with the options.

**Options**

The `options` provides a map of values that will be passed to the builder. The provided command line args will be merged into this map. I.e., `nx test mylib --jestConfig=libs/mylib/another-jest.config.js` will pass the following to the builder:

```json
{
  "jestConfig": "libs/mylib/another-jest.config.js",
  "tsConfig": "libs/mylib/tsconfig.spec.json"
}
```

**Outputs**

The `outputs` property lists the folders the builder will create files in. The property is optional. If not provided, Nx will assume it is `dist/libs/mylib`.

```json
{
  "build": {
    "builder": "@nrwl/web:build",
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
    "builder": "@nrwl/web:build",
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

The following show how the builder options get constructed:

```bash
require(`@nrwl/jest`).builders['jest']({...options, ...selectedConfiguration, ...commandLineArgs}}) // Pseudocode
```

The selected configuration adds/overrides the default options, and the provided command line args add/override the configuration options.

### Schematics

You can configure default schematic options in `angular.json` as well. For instance, the following will tell Nx to always pass `--style=scss` when creating new libraries.

```json
{
  "schematics": {
    "@nrwl/angular:library": {
      "style": "scss"
    }
  }
}
```

### CLI Options

The following command will generate a new library: `nx g @nrwl/angular:lib mylib`. If you set the `defaultCollection` property, you can generate the lib without mentioning the collection name: `nx g lib mylib`.

```json
{
  "cli": {
    "defaultCollection": "@nrwl/angular"
  }
}
```

## nx.json

The `nx.json` file contains extra configuration options mostly related to the project graph.

```json
{
  "npmScope": "happyorg",
  "affected": {
    "defaultBase": "master"
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
    "angular.json": "*",
    "package.json": {
      "dependencies": "*",
      "devDependencies": "*"
    },
    "tsconfig.json": "*",
    "nx.json": "*"
  },
  "projects": {
    "myapp": {
      "tags": []
    },
    "mylib": {
      "tags": []
    },
    "myapp-e2e": {
      "tags": [],
      "implicitDependencies": ["myapp"]
    }
  }
}
```

**NPM Scope**

Tells Nx what prefix to use when generating library imports.

**Affected**

Tells Nx which branch and HEAD to use when calculating affected projects.

- `defaultBase` defines the default base branch, defaulted to `master`.

### Tasks Runner Options

Tasks runners are invoked when you run `nx test`, `nx build`, `nx run-many`, `nx affected`, etc.. The tasks runner named "default" will be, unsurprisingly, used by default. But you can specify a different one by passing `--runner`.

> A task is an invocation of a target.

Tasks runners can accept different options. The following are the options supported by `"@nrwl/workspace/tasks-runners/default"` and `"@nrwl/nx-cloud"`.

- `cacheableOperations` defines the list of targets/operations that will be cached by Nx.
- `strictlyOrderedTargets` defines the list of targets that need to be executed in the order defined by the dependency graph. Defaults to `['build']`
- `parallel` defines whether to run targets in parallel
- `maxParallel` defines the max number of processes used.
- `captureStderr` defines whether the cache will capture stderr or just stdout
- `skipNxCache` defines whether the Nx Cache should be skipped. Defaults to `false`
- `cacheDirectory` defines where the local cache is stored, which is `node_modules/.cache/nx` by default.
- `runtimeCacheInputs` defines the list of commands that will be run by the runner to include into the computation hash value.

`runtimeCacheInputs` can be set as follows:

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

You can configure `parallel` and `maxParallel` in `nx.json`, but you can also pass them in the terminal `nx run-many --target=test --parallel`.

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
    "angular.json": "*",
    "package.json": {
      "dependencies": "*",
      "devDependencies": {
        "mypackage": ["mylib"]
      }
    },
    "globalFile": ["myapp"],
    "styles/**/*.css": ["myapp"]
  }
}
```

In the example above:

- Changing `angular.json` will affect every project.
- Changing the `dependencies` property in `package.json` will affect every project.
- Changing the `devDependencies` property in `package.json` will only affect `mylib`.
- Changing `globalFile` will only affect `myapp`.
- Changing any CSS file inside the `styles` directory will only affect `myapp`.

You can also add dependencies between projects. For instance, the example below defines a dependency from `myapp-e2e` to `myapp`, such that every time `myapp` is affected, `myapp-e2e` is affected as well.

```json
{
  "projects": {
    "myapp": {
      "tags": []
    },
    "myapp-e2e": {
      "tags": [],
      "implicitDependencies": ["myapp"]
    }
  }
}
```

## .nxignore

You may optionally add an `.nxignore` file to the root. This file is used to specify files in your workspace that should be completely ignored by nx.

The syntax is the same as a [`.gitignore` file](https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository#_ignoring).

**When a file is specified in the `.nxignore` file:**

1. Changes to that file will not be taken into account in the `affected` calculations.
2. Even if the file is outside an app or library, `nx workspace-lint` will not warn about it.

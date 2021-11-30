# Configuration

There are three top-level configuration files every Nx workspace has: `angular.json`, `nx.json`, and `tsconfig.base.json`. Many Nx plugins modify these files when generating new code, but you can also modify them manually.

## angular.json

The `angular.json` configuration file contains information about the targets and generators. Let's look at the following example:

```json
{
  "projects": {
    "myapp": {
      "root": "apps/myapp/",
      "sourceRoot": "apps/myapp/src",
      "projectType": "application",
      "architect": {
        "build": {
          "builder": "@nrwl/web:webpack",
          "outputs": ["dist/apps/myapp"],
          "dependsOn": [
            {
              "target": "build",
              "projects": "dependencies"
            }
          ],
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
    "architect": {},
    "tags": [],
    "implicitDependencies": []
  }
}
```

- `root` tells Nx the location of the library including its sources and configuration files.
- `sourceRoot` tells Nx the location of the library's source files.
- `projectType` is either 'application' or 'library'. The project type is used in dep graph viz and in a few aux commands.
- `architect` configures all the targets which define what tasks you can run against the library.
- `tags` configures tags used for linting
- `implicitDependencies` configure implicit dependencies between projects in the workspace ([see below](#implicit-dependencies))

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

The name of the target `test` means that you can invoke it as follows: `nx test mylib` or `nx run mylib:test`. The name isn't significant in any other way. If you rename it to, for example, `mytest`, you will be able to run as follows: `nx mytest mylib` or `nx run mylib:mytest`.

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

The `outputs` property lists the folders the builder creates files in. The property is optional. If not provided, Nx assumes it is `dist/libs/mylib`.

```json
{
  "build": {
    "builder": "@nrwl/web:webpack",
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
    "builder": "@nrwl/web:webpack",
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

```javascript
require(`@nrwl/jest`).builders['jest']({...options, ...selectedConfiguration, ...commandLineArgs}}) // Pseudocode
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

````

### workspace.json

Your `angular.json` file can be renamed to `workspace.json` and Nx will process it in the same way. The `workspace.json` has one additional top level property `version`. Setting `version` to 1 means the `workspace.json` file syntax is identical to `angular.json` When the `version` of `workspace.json` is set to 2, `targets`, `generators` and `executor` properties are used instead of the version 1 properties `architect`, `schematics` and `builder`.

## project.json

In version 2 workspaces, project configurations can also be independent files, referenced by `angular.json`. For instance, an `angular.json` may contain projects configured as below.

```json
{
  "projects": {
    "mylib": "libs/mylib"
  }
}
````

This tells Nx that all configuration for that project is found in the `libs/mylib/project.json` file.

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

## nx.json

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
    "angular.json": "*",
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

> Projects utilizing `project.json` files will not be present in `nx.json`.

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
    "angular.json": "*",
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

- Changing `angular.json` affects every project.
- Changing the `dependencies` property in `package.json` affects every project.
- Changing the `devDependencies` property in `package.json` only affects `mylib`.
- Changing any of the custom check `scripts` in `package.json` affects every project.
- Changing `globalFile` only affects `myapp`.
- Changing any CSS file inside the `styles` directory only affects `myapp`.

You can also add dependencies between projects in `angular.json`. For instance, the example below defines a dependency from `myapp-e2e` to `myapp`, such that every time `myapp` is affected, `myapp-e2e` is affected as well.

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

````json
{
  "generators": {
    "@nrwl/angular:library": {
      "style": "scss"
    }
  }
}

## .nxignore

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
````

# Configuration

There are three top-level configuration files every Nx workspace has: `workspace.json`, `nx.json`, and `tsconfig.json`. Many Nx plugins will modify these files when generating new code, but you can also modify them manually.

## workspace.json

The `workspace.json` configuration file contains information about the targets and generators. Let's look at the following example:

```json
{
  "version": 2,
  "projects": {
    "myapp": {
      "root": "apps/myapp/",
      "sourceRoot": "apps/myapp/src",
      "projectType": "application",
      "targets": {
        "build": {
          "executor": "@nrwl/web:build",
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
          "executor": "@nrwl/web:dev-server",
          "options": {
            "buildTarget": "myapp:build",
            "proxyConfig": "apps/myapp/proxy.conf.json"
          }
        },
        "test": {
          "executor": "@nrwl/jest:jest",
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
      "targets": {
        "test": {
          "executor": "@nrwl/jest:jest",
          "options": {
            "jestConfig": "libs/mylib/jest.config.js",
            "tsConfig": "libs/mylib/tsconfig.spec.json"
          }
        }
      }
    }
  },
  "cli": {
    "defaultCollection": "@nrwl/react"
  },
  "generators": {
    "@nrwl/react:library": {
      "js": true
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
    "targets": {}
  }
}
```

- `root` tells Nx the location of the library including its sources and configuration files.
- `sourceRoot` tells Nx the location of the library's source files.
- `projectType` is either 'application' or 'library'.
- `targets` configures all the targets which define what tasks you can run against the library.

### Targets

Let's look at the simple target:

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

The name of the target `test` means that you can invoke it as follows: `nx test mylib` or `nx run mylib:test`. The name isn't significant in any other way. If you rename it to, for example, `mytest`, you will be able to run as follows: `nx run mylib:mytest`.

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

The `outputs` property lists the folders the executor will create files in. The property is optional. If not provided, Nx will assume it is `dist/libs/mylib`.

```json
{
  "build": {
    "executor": "@nrwl/web:build",
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
    "executor": "@nrwl/web:build",
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

```bash
require(`@nrwl/jest`).executors['jest']({...options, ...selectedConfiguration, ...commandLineArgs}}) // Pseudocode
```

The selected configuration adds/overrides the default options, and the provided command line args add/override the configuration options.

### Generators

You can configure default generator options in `workspace.json` as well. For instance, the following will tell Nx to always pass `--js` when creating new libraries.

```json
{
  "generators": {
    "@nrwl/react:library": {
      "js": true
    }
  }
}
```

You can also do it on the project level:

```json
{
  "mylib": {
    "root": "libs/mylib/",
    "sourceRoot": "libs/mylib/src",
    "projectType": "library",
    "generators": {
      "@nrwl/react:component": {
        "classComponent": true
      }
    },
    "targets": {}
  }
}
```

### CLI Options

The following command will generate a new library: `nx g @nrwl/react:lib mylib`. If you set the `defaultCollection` property, you can generate the lib without mentioning the collection name: `nx g lib mylib`.

```json
{
  "cli": {
    "defaultCollection": "@nrwl/react"
  }
}
```

### Version

When the `version` of `workspace.json` is set to 2, `targets`, `generators` and `executor` properties are used instead of the version 1 properties `architect`, `schematics` and `builder`.

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
    "workspace.json": "*",
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
- `encryptionKey` (when using `"@nrwl/nx-cloud"` only) defines an encryption key to support end-to-end encryption of your cloud cache. You may also provide an environment variable with the key `NX_CLOUD_ENCRYPTION_KEY` that contains an encryption key as its value. The Nx Cloud task runner will normalize the key length, so any length of key is acceptable.
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

- Changing `workspace.json` will affect every project.
- Changing the `dependencies` property in `package.json` will affect every project.
- Changing the `devDependencies` property in `package.json` will only affect `mylib`.
- Changing any of the custom check `scripts` in `package.json` will affect every project.
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

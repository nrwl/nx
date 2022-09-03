# nx.json

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
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": ["!{projectRoot}/**/*.spec.tsx"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "dependsOn": ["^build"]
    }
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

### inputs & namedInputs

Named inputs defined in `nx.json` are merged with the named inputs defined in each project's project.json.
In other words, every project has a set of named inputs, and it's defined as: `{...namedInputsFromNxJson, ...namedInputsFromProjectsProjectJson}`.

Defining `inputs` for a given target would replace the set of inputs for that target name defined in `nx.json`.
Using pseudocode `inputs = projectJson.targets.build.inputs || nxJson.targetDefaults.build.inputs`.

You can also define and redefine named inputs. This enables one key use case, where your `nx.json` can define things
like this (which applies to every project):

```
"test": {
  "inputs": [
    "default",
    "^production"
  ]
}
```

And projects can define their prod fileset, without having to redefine the inputs for the `test` target.

```json title="project.json"
{
  "namedInputs": {
    "production": [
      "!{projectRoot}/**/*.test.js",
      "{workspacRoot}/jest.config.js"
    ]
  }
}
```

In this case Nx will use the right `prod` input for each project.

### Target Defaults

Targets can depend on other targets. A common scenario is having to build dependencies of a project first before
building the project. The `dependsOn` property in `project.json` can be used to define the list of dependencies of an
individual target.

Often the same `dependsOn` configuration has to be defined for every project in the repo, and that's when
defining `targetDefaults` in `nx.json` is helpful.

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

The configuration above is identical to adding `{"dependsOn": ["^build"]}` to every build target of every project.

Another target default you can configure is `outputs`:

```json
{
  "targetDefaults": {
    "build": {
      "outputs": ["./custom-dist"]
    }
  }
}
```

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

### Tasks Runner Options

> A task is an invocation of a target.

Tasks runners are invoked when you run `nx test`, `nx build`, `nx run-many`, `nx affected`, and so on. The tasks runner
named "default" is used by default. Specify a different one like this `nx run-many --target=build --all --runner=another`.

Tasks runners can accept different options. The following are the options supported
by `"nx/tasks-runners/default"` and `"@nrwl/nx-cloud"`.

| Property                | Descrtipion                                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cacheableOperations     | defines the list of targets/operations that are cached by Nx                                                                                                                                                                                                                                                                                  |
| parallel                | defines the max number of targets ran in parallel (in older versions of Nx you had to pass `--parallel --maxParallel=3` instead of `--parallel=3`)                                                                                                                                                                                            |
| captureStderr           | defines whether the cache captures stderr or just stdout                                                                                                                                                                                                                                                                                      |
| skipNxCache             | defines whether the Nx Cache should be skipped (defaults to `false`)                                                                                                                                                                                                                                                                          |
| cacheDirectory          | defines where the local cache is stored (defaults to `node_modules/.cache/nx`)                                                                                                                                                                                                                                                                |
| encryptionKey           | (when using `"@nrwl/nx-cloud"` only) defines an encryption key to support end-to-end encryption of your cloud cache. You may also provide an environment variable with the key `NX_CLOUD_ENCRYPTION_KEY` that contains an encryption key as its value. The Nx Cloud task runner normalizes the key length, so any length of key is acceptable |
| runtimeCacheInputs      | defines the list of commands that are run by the runner to include into the computation hash value                                                                                                                                                                                                                                            |
| selectivelyHashTsConfig | only hash the path mapping of the active project in the `tsconfig.base.json` (e.g., adding/removing projects doesn't affect the hash of existing projects) (defaults to `false`)                                                                                                                                                              |

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

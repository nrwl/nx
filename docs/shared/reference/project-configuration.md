# Project Configuration

Projects can be configured in `package.json` (if you use npm scripts and not Nx executors) and `project.json` (if you
[use task executors](/plugin-features/use-task-executors)). Both `package.json` and `project.json` files are located in each project's folder. Nx merges the two
files to get each project's configuration.

The following configuration creates `build` and `test` targets for Nx.

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="package.json" %}
{
  "name": "mylib",
  "scripts": {
    "test": "jest",
    "build": "tsc -p tsconfig.lib.json" // the actual command here is arbitrary
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="project.json" %}
{
  "root": "libs/mylib/",
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        /* ... */
      }
    },
    "build": {
      "executor": "@nx/js:tsc",
      "options": {
        /* ... */
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

You can invoke `nx build mylib` or `nx test mylib` without any extra configuration.

You can add Nx-specific configuration as follows:

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="package.json" %}
{
  "name": "mylib",
  "scripts": {
    "test": "jest",
    "build": "tsc -p tsconfig.lib.json", // the actual command here is arbitrary
    "ignored": "exit 1"
  },
  "nx": {
    "namedInputs": {
      "default": ["{projectRoot}/**/*"],
      "production": ["!{projectRoot}/**/*.spec.tsx"]
    },
    "targets": {
      "build": {
        "inputs": ["production", "^production"],
        "outputs": ["{workspaceRoot}/dist/libs/mylib"],
        "dependsOn": ["^build"]
      },
      "test": {
        "inputs": ["default", "^production"],
        "outputs": [],
        "dependsOn": ["build"]
      }
    },
    "includedScripts": ["test", "build"] // If you want to limit the scripts Nx sees, you can specify a list here.
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json {% fileName="project.json" %}
{
  "root": "libs/mylib/",
  "sourceRoot": "libs/mylib/src",
  "projectType": "library",
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": ["!{projectRoot}/**/*.spec.tsx"]
  },
  "targets": {
    "test": {
      "executor": "@nx/jest:jest",
      "inputs": ["default", "^production"],
      "outputs": [],
      "dependsOn": ["build"],
      "options": {}
    },
    "build": {
      "executor": "@nx/js:tsc",
      "inputs": ["production", "^production"],
      "outputs": ["{workspaceRoot}/dist/libs/mylib"],
      "dependsOn": ["^build"],
      "options": {}
    }
  },
  "tags": ["scope:myteam"],
  "implicitDependencies": ["anotherlib"]
}
```

{% /tab %}
{% /tabs %}

### inputs & namedInputs

The `inputs` array tells Nx what to consider to determine whether a particular invocation of a script should be a cache
hit or not. There are three types of inputs:

_Filesets_

Examples:

- `{projectRoot}/**.*.ts`
- same as `{fileset: "{projectRoot}/**/*.ts"}`
- `{workspaceRoot}/jest.config.ts`
- same as `{fileset: "{workspaceRoot}/jest.config.ts}`

{% callout type="note" title="inputs syntax" %}

The `inputs` and `namedInputs` are parsed with the following rules:

1. `{projectRoot}` and `{workspaceRoot}` are replaced with the appropriate path
2. A `^` character at the beginning of the string means this entry applies to the project dependencies of the project, not the project itself.
3. Everything else is processed with the [minimatch](https://github.com/isaacs/minimatch) library

{% /callout %}

_Runtime Inputs_

Examples:

- `{runtime: "node -v"}`

Note the result value is hashed, so it is never displayed.

_Env Variables_

Examples:

- `{env: "MY_ENV_VAR"}`

Note the result value is hashed, so it is never displayed.

_External Dependencies_

For official plugins, Nx intelligently finds a set of external dependencies which it hashes for the target. `nx:run-commands` is an exception to this.
Because you may specify any command to be run, it is not possible to determine which, if any, external dependencies are used by the target.
To be safe, Nx assumes that updating any external dependency invalidates the cache for the target.

> Note: Community plugins are also treated like `nx:run-commands`

This input type allows you to override this cautious behavior by specifying a set of external dependencies to hash for the target.

Examples:

Targets that only use commands natively available in the terminal will not depend on any external dependencies. Specify an empty array to not hash any external dependencies.

```json
{
  "targets": {
    "copyFiles": {
      "inputs": [
        {
          "externalDependencies": []
        }
      ],
      "command": "cp src/assets dist"
    }
  }
}
```

If a target uses a command from an npm package, that package should be listed.

```json
{
  "targets": {
    "copyFiles": {
      "inputs": [
        {
          "externalDependencies": ["lerna"]
        }
      ],
      "command": "npx lerna publish"
    }
  }
}
```

_Dependent tasks output_

This input allows us to depend on the output, rather than the input of the dependent tasks. We can specify the glob pattern to match only the subset of the output files.
The `transitive` parameter defines whether the check and the pattern should be recursively applied to the dependent tasks of the child tasks.

Examples:

```json
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": ["default", "!{projectRoot}/**/*.spec.ts"],
    "deps": [{ "dependentTasksOutputFiles": "**/*.d.ts", "transitive": true }]
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "deps"]
    }
  }
}
```

_Named Inputs_

Examples:

- `inputs: ["production"]`
- same as `"inputs": [{"input": "production", "projects": "self"}]` in versions prior to Nx 16, or `"inputs": [{"input": "production"}]` after version 16.

Often the same glob will appear in many places (e.g., prod fileset will exclude spec files for all projects). Because
keeping them in sync is error-prone, we recommend defining `namedInputs`, which you can then reference in all of those
places.

#### Using ^

Examples:

- `inputs: ["^production"]`
- same as `inputs: [{"input": "production", "projects": "dependencies"}]` prior to Nx 16, or `"inputs": [{"input": "production", "dependencies": true }]` after version 16.

Similar to `dependsOn`, the "^" symbols means "dependencies". This is a very important idea, so let's illustrate it with
an example.

```json
{
  "targets": {
    "test": {
      "inputs": ["default", "^production"]
    }
  }
}
```

The configuration above means that the test target depends on all source files of a given project and only prod
sources (non-test sources) of its dependencies. In other words, it treats test sources as private.

{% cards %}
{% card title="nx.json reference" type="documentation" description="inputs and namedInputs are also described in the nx.json reference" url="/reference/nx-json#inputs-&-namedinputs" /%}
{% card title="Customizing inputs and namedInputs" type="documentation" description="This guide walks through a few examples of how to customize inputs and namedInputs" url="/more-concepts/customizing-inputs" /%}
{% /cards %}

### outputs

Targets may define outputs to tell Nx where the target is going to create file artifacts that Nx should cache. `"outputs": ["{workspaceRoot}/dist/libs/mylib"]` tells Nx where the `build` target is going to create file artifacts.

This configuration is usually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which implement the configuration above.

Specifically, by default, the following locations are cached for builds:

- `{workspaceRoot}/dist/{projectRoot}`,
- `{projectRoot}/build`,
- `{projectRoot}/dist`,
- `{projectRoot}/public`

#### Basic Example

Usually, a target writes to a specific directory or a file. The following instructs Nx to cache `dist/libs/mylib` and `build/libs/mylib/main.js`:

```json
{
  "targets": {
    "build": {
      "outputs": [
        "{workspaceRoot}/dist/libs/mylib",
        "{workspaceRoot}/build/libs/mylib/main.js"
      ]
    }
  }
}
```

#### Specifying Globs

Sometimes, multiple targets might write to the same directory. When possible it is recommended to direct these targets into separate directories.

```json
{
  "targets": {
    "build-js": {
      "outputs": ["{workspaceRoot}/dist/libs/mylib/js"]
    },
    "build-css": {
      "outputs": ["{workspaceRoot}/dist/libs/mylib/css"]
    }
  }
}
```

But if the above is not possible, globs (parsed with the [minimatch](https://github.com/isaacs/minimatch) library) can be specified as outputs to only cache a set of files rather than the whole directory.

```json
{
  "targets": {
    "build-js": {
      "outputs": ["{workspaceRoot}/dist/libs/mylib/**/*.js"]
    },
    "build-css": {
      "outputs": ["{workspaceRoot}/dist/libs/mylib/**/*.css"]
    }
  }
}
```

### dependsOn

Targets can depend on other targets. This is the relevant portion of the configuration file:

```json
{
  "targets": {
    "build": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

A common scenario is having to build dependencies of a project first before building the project. This is what
the `"dependsOn": ["^build"]` property of the `build` target configures. It tells Nx that before it can build `mylib` it
needs to make
sure that `mylib`'s dependencies are built as well. This doesn't mean Nx is going to rerun those builds. If the right
artifacts are already in the right place, Nx will do nothing. If they aren't in the right place, but they are available
in the cache, Nx will retrieve them from the cache.

Another common scenario is for a target to depend on another target of the same project. For
instance, `"dependsOn": ["build"]` of
the `test` target tells Nx that before it can test `mylib` it needs to make sure that `mylib` is built, which will
result in `mylib`'s dependencies being built as well.

You can also express task dependencies with an object syntax:

{% tabs %}
{% tab label="Version < 16" %}

```json
{
  "targets": {
    "build": {
      "dependsOn": [
        {
          "projects": "dependencies", // "dependencies" or "self"
          "target": "build", // target name
          "params": "ignore" // "forward" or "ignore", defaults to "ignore"
        }
      ]
    }
  }
}
```

{% /tab %}
{% tab label="Version 16+ (self)" %}

```json
{
  "targets": {
    "build": {
      "dependsOn": [
        {
          "target": "build", // target name
          "params": "ignore" // "forward" or "ignore", defaults to "ignore"
        }
      ]
    }
  }
}
```

{% /tab %}
{% tab label="Version 16+ (dependencies)" %}

```json
{
  "targets": {
    "build": {
      "dependsOn": [
        {
          "dependencies": true, // Run this target on all dependencies first
          "target": "build", // target name
          "params": "ignore" // "forward" or "ignore", defaults to "ignore"
        }
      ]
    }
  }
}
```

{% /tab %}
{% tab label="Version 16+ (specific projects)" %}

```json
{
  "targets": {
    "build": {
      "dependsOn": [
        {
          "projects": ["my-app"], // Run build on "my-app" first
          "target": "build", // target name
          "params": "ignore" // "forward" or "ignore", defaults to "ignore"
        }
      ]
    }
  }
}
```

{% /tab %}
{% /tabs %}

#### Examples

You can write the shorthand configuration above in the object syntax like this:

{% tabs %}
{% tab label="Version < 16" %}

```json
{
  "targets": {
    "build": {
      "dependsOn": [{ "projects": "dependencies", "target": "build" }]
    },
    "test": {
      "dependsOn": [{ "projects": "self", "target": "build" }]
    }
  }
}
```

{% /tab %}
{% tab label="Version 16+" %}

```json
{
  "targets": {
    "build": {
      "dependsOn": [{ "dependencies": true, "target": "build" }] // Run build on my dependencies first
    },
    "test": {
      "dependsOn": [{ "target": "build" }] // Run build on myself first
    }
  }
}
```

{% /tab %}
{% /tabs %}

With the expanded syntax, you also have a third option available to configure how to handle the params passed to the target. You can either forward them or you can ignore them (default).

{% tabs %}
{% tab label="Version < 16" %}

```json
{
  "targets": {
    "build": {
      // forward params passed to this target to the dependency targets
      "dependsOn": [
        { "projects": "dependencies", "target": "build", "params": "forward" }
      ]
    },
    "test": {
      // ignore params passed to this target, won't be forwarded to the dependency targets
      "dependsOn": [
        { "projects": "dependencies", "target": "build", "params": "ignore" }
      ]
    },
    "lint": {
      // ignore params passed to this target, won't be forwarded to the dependency targets
      "dependsOn": [{ "projects": "dependencies", "target": "build" }]
    }
  }
}
```

{% /tab %}
{% tab label="Version 16+" %}

```json
{
  "targets": {
    "build": {
      // forward params passed to this target to the dependency targets
      "dependsOn": [
        { "projects": "{dependencies}", "target": "build", "params": "forward" }
      ]
    },
    "test": {
      // ignore params passed to this target, won't be forwarded to the dependency targets
      "dependsOn": [
        { "projects": "{dependencies}", "target": "build", "params": "ignore" }
      ]
    },
    "lint": {
      // ignore params passed to this target, won't be forwarded to the dependency targets
      "dependsOn": [{ "projects": "{dependencies}", "target": "build" }]
    }
  }
}
```

{% /tab %}
{% /tabs %}

This also works when defining a relation for the target of the project itself using `"projects": "self"`:

{% tabs %}
{% tab label="Version < 16" %}

```json
{
  "targets": {
    "build": {
      // forward params passed to this target to the project target
      "dependsOn": [
        { "projects": "self", "target": "pre-build", "params": "forward" }
      ]
    }
  }
}
```

{% /tab %}
{% tab label="Version 16+" %}

```json
{
  "targets": {
    "build": {
      // forward params passed to this target to the project target
      "dependsOn": [{ "target": "pre-build", "params": "forward" }]
    }
  }
}
```

{% /tab %}
{% /tabs %}

Additionally, when using the expanded object syntax, you can specify individual projects in version 16 or greater.

{% tabs %}
{% tab label="Version 16+" %}

```json
{
  "targets": {
    "build": {
      // Run is-even:pre-build and is-odd:pre-build before this target
      "dependsOn": [
        { "projects": ["is-even", "is-odd"], "target": "pre-build" }
      ]
    }
  }
}
```

{% /tab %}
{% /tabs %}

This configuration is usually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which implement the
configuration above.

### tags

You can annotate your projects with `tags` as follows:

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="package.json" %}
{
  "name": "mylib",
  "nx": {
    "tags": ["scope:myteam"]
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="project.json" %}
{
  "root": "/libs/mylib",
  "tags": ["scope:myteam"]
}
```

{% /tab %}
{% /tabs %}

You can [configure lint rules using these tags](/core-features/enforce-project-boundaries) to, for instance, ensure that libraries
belonging to `myteam` are not depended on by libraries belong to `theirteam`.

### implicitDependencies

Nx uses powerful source-code analysis to figure out your workspace's project graph. Some dependencies cannot be deduced statically, so you can set them manually like this. The `implicitDependencies` property is parsed with the [minimatch](https://github.com/isaacs/minimatch) library, so you can review that syntax for more advanced use cases.

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="package.json" %}
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["anotherlib"]
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="project.json" %}
{
  "root": "/libs/mylib",
  "implicitDependencies": ["anotherlib"]
}
```

{% /tab %}
{% /tabs %}

You can also remove a dependency as follows:

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="package.json" %}
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["!anotherlib"] # regardless of what Nx thinks, "mylib" doesn't depend on "anotherlib"
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="project.json" %}
{
  "root": "/libs/mylib",
  "implicitDependencies": ["!anotherlib"] # regardless of what Nx thinks, "mylib" doesn't depend on "anotherlib"
}
```

{% /tab %}
{% /tabs %}

An implicit dependency could also be a glob pattern:

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="package.json" %}
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["shop-*"] # "mylib" depends on all projects beginning with "shop-"
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc {% fileName="project.json" %}
{
  "root": "/libs/mylib",
  "implicitDependencies": ["shop-*"] # "mylib" depends on all projects beginning with "shop-"
}
```

{% /tab %}
{% /tabs %}

### Including package.json files as projects in the graph

Any `package.json` file that is referenced by the `workspaces` property in the root `package.json` file will be included as a project in the graph. If you are using Lerna, projects defined in `lerna.json` will be included. If you are using pnpm, projects defined in `pnpm-workspace.yml` will be included.

If you want to ignore a particular `package.json` file, exclude it from those tools. For example, you can add `!packages/myproject` to the `workspaces` property.

### Ignoring package.json scripts

Nx merges package.json scripts with your targets that are defined in project.json.
If you only wish for some scripts to be used as Nx targets, you can specify them in the `includedScripts` property of the project's package.json.

```json {% filename="packages/my-library/package.json" }
{
  "name": "my-library",
  "version": "0.0.1",
  "scripts": {
    "build": "tsc",
    "postinstall": "node ./tasks/postinstall"
  },
  "nx": {
    "includedScripts": ["build"]
  }
}
```

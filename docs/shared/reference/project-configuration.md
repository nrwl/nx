# Project Configuration

Projects can be configured in `package.json` (if you use npm scripts and not Nx executors) and `project.json` (if you
[use task executors](/plugin-features/use-task-executors)). Both `package.json` and `project.json` files are located in each project's folder. Nx merges the two
files to get each project's configuration. This reference

The following configuration creates `build` and `test` targets for Nx.

{% tabs %}
{% tab label="package.json" %}

```jsonc
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

```jsonc
{
  "root": "libs/mylib/",
  "targets": {
    "test": {
      "executor": "@nrwl/jest:jest",
      "options": {
        /* ... */
      }
    },
    "build": {
      "executor": "@nrwl/js:tsc",
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

```jsonc
{
  "name": "mylib",
  "scripts": {
    "test: "jest",
    "build": "tsc -p tsconfig.lib.json" // the actual command here is arbitrary
  },
  "nx": {
    "namedInputs": {
      "default": [
        "{projectRoot}/**/*"
      ],
      "production": [
        "!{projectRoot}/**/*.spec.tsx"
      ]
    },
    "targets": {
      "build": {
        "inputs": ["production", "^production"],
        "outputs": ["dist/libs/mylib"],
        "dependsOn": ["^build"]
      },
      "test": {
        "inputs": ["default", "^production"],
        "outputs": [],
        "dependsOn": ["build"]
      }
    }
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json
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
      "executor": "@nrwl/jest:jest",
      "inputs": ["default", "^production"],
      "outputs": [],
      "dependsOn": ["build"],
      "options": {}
    },
    "build": {
      "executor": "@nrwl/js:tsc",
      "inputs": ["production", "^production"],
      "outputs": ["dist/libs/mylib"],
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

_Runtime Inputs_

Examples:

- `{runtime: "node -v"}`

Note the result value is hashed, so it is never displayed.

_Env Variables_

Examples:

- `{env: "MY_ENV_VAR"}`

Note the result value is hashed, so it is never displayed.

_Named Inputs_

Examples:

- `inputs: ["production"]`
- same as `inputs: [{input: "production", projects: "self"}]`

Often the same glob will appear in many places (e.g., prod fileset will exclude spec files for all projects). Because
keeping them in sync is error-prone, we recommend defining named inputs, which you can then reference in all of those
places.

#### Using ^

Examples:

- `inputs: ["^production"]`
- same as `inputs: [{input: "production", projects: "dependencies"}]`

Similar to `dependsOn`, the "^" symbols means "dependencies". This is a very important idea, so let's illustrate it with
an example.

```
"test": {
  "inputs": [ "default", "^production" ]
}
```

The configuration above means that the test target depends on all source files of a given project and only prod
sources (non-test sources) of its dependencies. In other words, it treats test sources as private.

### outputs

Targets may define outputs to tell Nx where the target is going to create file artifacts that Nx should cache. `"outputs": ["dist/libs/mylib"]` tells Nx where the `build` target is going to create file artifacts.

This configuration is usually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which implement the configuration above.

#### Basic Example

Usually, a target writes to a specific directory or a file. The following instructs Nx to cache `dist/libs/mylib` and `build/libs/mylib/main.js`:

```json
{
  "build": {
    "outputs": ["dist/libs/mylib", "build/libs/mylib/main.js"]
  }
}
```

#### Specifying Globs

Sometimes, multiple targets might write to the same directory. When possible it is recommended to direct these targets into separate directories.

```json
{
  "build-js": {
    "outputs": ["dist/libs/mylib/js"]
  },
  "build-css": {
    "outputs": ["dist/libs/mylib/css"]
  }
}
```

But if the above is not possible, globs can be specified as outputs to only cache a set of files rather than the whole directory.

```json
{
  "build-js": {
    "outputs": ["dist/libs/mylib/**/*.js"]
  },
  "build-css": {
    "outputs": ["dist/libs/mylib/**/*.css"]
  }
}
```

### dependsOn

Targets can depend on other targets. This is the relevant portion of the configuration file:

```json
"build": {
  "dependsOn": ["^build"]
},
"test": {
  "dependsOn": ["build"]
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

You can also express the same configuration using:

```json
"build": {
  "dependsOn": [{ "projects": "dependencies", "target": "build" }]
},
"test": {
  "dependsOn": [{ "projects": "self", "target": "build" }]
}
```

With the expanded syntax, you also have a third option available to configure how to handle the params passed to the target. You can either forward them or you can ignore them (default).

```json
"build": {
   // forward params passed to this target to the dependency targets
  "dependsOn": [{ "projects": "dependencies", "target": "build", "params": "forward" }]
},
"test": {
  // ignore params passed to this target, won't be forwarded to the dependency targets
  "dependsOn": [{ "projects": "dependencies", "target": "build", "params": "ignore" }]
}
"lint": {
  // ignore params passed to this target, won't be forwarded to the dependency targets
  "dependsOn": [{ "projects": "dependencies", "target": "build" }]
}
```

Obviously this also works when defining a relation for the target of the project itself using `"projects": "self"`:

```json
"build": {
   // forward params passed to this target to the project target
  "dependsOn": [{ "projects": "self", "target": "pre-build", "params": "forward" }]
}
```

This configuration is usually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which implement the
configuration above.

### tags

You can annotate your projects with `tags` as follows:

{% tabs %}
{% tab label="package.json" %}

```jsonc
{
  "name": "mylib",
  "nx": {
    "tags": ["scope:myteam"]
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc
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

Nx uses powerful source-code analysis to figure out your workspace's project graph. Some dependencies cannot be deduced
statically, so you can set them manually like this:

{% tabs %}
{% tab label="package.json" %}

```jsonc
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["anotherlib"]
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc
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

```jsonc
{
  "name": "mylib",
  "nx": {
    "implicitDependencies": ["!anotherlib"] # regardless of what Nx thinks, "mylib" doesn't depend on "anotherlib"
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```jsonc
{
  "root": "/libs/mylib",
  "implicitDependencies": ["!anotherlib"] # regardless of what Nx thinks, "mylib" doesn't depend on "anotherlib"
}
```

{% /tab %}
{% /tabs %}

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

# Project Configuration

A project's configuration is constructed by Nx from three sources:

1. [Tasks inferred by Nx plugins](/concepts/inferred-tasks) from tooling configuration
2. [Workspace `targetDefaults`](/reference/nx-json#target-defaults) defined in the `nx.json` file
3. Individual project level configuration files (`package.json` and `project.json`)

Each source will [overwrite the previous source](/recipes/running-tasks/pass-args-to-commands). That means `targetDefaults` will overwrite inferred tasks and project level configuration will overwrite both `targetDefaults` and inferred tasks. The combined project configuration can be viewed in the project details view by using [Nx Console](/getting-started/editor-setup) in your IDE or by running:

```shell
nx show project myproject --web
```

{% project-details title="Project Details View" height="100px" %}

```json
{
  "project": {
    "name": "demo",
    "data": {
      "root": " packages/demo",
      "projectType": "application",
      "targets": {
        "dev": {
          "executor": "nx:run-commands",
          "options": {
            "command": "vite dev"
          },
          "metadata": {
            "technologies": ["vite"]
          }
        },
        "build": {
          "executor": "nx:run-commands",
          "inputs": ["production", "^production"],
          "outputs": ["{projectRoot}/dist"],
          "options": {
            "command": "vite build"
          },
          "metadata": {
            "technologies": ["vite"]
          }
        }
      }
    }
  },
  "sourceMap": {
    "targets": ["packages/demo/vite.config.ts", "@nx/vite"],
    "targets.dev": ["packages/demo/vite.config.ts", "@nx/vite"],
    "targets.build": ["packages/demo/vite.config.ts", "@nx/vite"]
  }
}
```

{% /project-details %}

The project details view also shows where each setting is defined so that you know where to change it.

## Project Level Configuration Files

If you need to edit your project settings or modify an inferred task, you can do so in either `package.json` or `project.json` files. The examples on this page show both styles, and the only functional difference is that tasks that use executors must be defined in a `project.json`. Nx merges the two
files to get each project's configuration. The full [machine readable schema](https://github.com/nrwl/nx/blob/master/packages/nx/schemas/project-schema.json) is available on GitHub.

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

Below are some more complete examples of project configuration files. For a more intuitive understanding of the roles of each option, you can highlight the options in the excerpt below that relate to different categories. Orchestration settings control the way [Nx runs tasks](/features/run-tasks). Execution settings control the actual task that is run. Caching settings control when [Nx caches a task](/features/cache-task-results) and what is actually cached.

{% tabs %}
{% tab label="package.json" %}

```jsonc {% fileName="package.json" lineGroups={ Orchestration:[14,17,19,22,25],Execution:[4,5,6],Caching:[9,10,11,12,15,16,20,21] } %}
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

```json {% fileName="project.json" lineGroups={ "Orchestration": [5,6,12,15,19,22], "Execution": [12,16,17,19,22,23], "Caching": [7,8,9,10,13,14,20,21] } %}
{
  "root": "libs/mylib/",
  "sourceRoot": "libs/mylib/src",
  "projectType": "library",
  "tags": ["scope:myteam"],
  "implicitDependencies": ["anotherlib"],
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": ["!{projectRoot}/**/*.spec.tsx"]
  },
  "targets": {
    "test": {
      "inputs": ["default", "^production"],
      "outputs": [],
      "dependsOn": ["build"],
      "executor": "@nx/jest:jest",
      "options": {}
    },
    "build": {
      "inputs": ["production", "^production"],
      "outputs": ["{workspaceRoot}/dist/libs/mylib"],
      "dependsOn": ["^build"],
      "executor": "@nx/js:tsc",
      "options": {}
    }
  }
}
```

{% /tab %}
{% /tabs %}

## Task Definitions (Targets)

A large portion of project configuration is related to defining the tasks for the project. In addition, to defining what the task actually does, a task definition also has properties that define the way that Nx should run that task. Those properties are described in detail below.

### Cache

In Nx 17 and higher, caching is configured by specifying `"cache": true` in a target's configuration. This will tell Nx that it's ok to cache the results of a given target. For instance, if you have a target that runs tests, you can specify `"cache": true` in the target default configuration for `test` and Nx will cache the results of running tests.

```json {% fileName="project.json" %}
{
  "targets": {
    "test": {
      "cache": true
    }
  }
}
```

{% callout type="warning" title="Per Project Caching + Distribution" %}

If you are using distributed task execution and disable caching for a given target, you will not be able to use distributed task execution for that target. This is because distributed task execution requires caching to be enabled. This means that the target you have disabled caching for, and any targets which depend on that target will fail the pipeline if you try to run them with Nx Agents enabled.

{% /callout %}

### Inputs and Named Inputs

Each cacheable task needs to define `inputs` which determine whether the task outputs can be retrieved from the cache or the task needs to be re-run. The `namedInputs` defined in `nx.json` or project level configuration are sets of reusable input definitions.

A typical set of inputs may look like this:

```jsonc {% fileName="" %}
{
  "namedInputs": {
    "default": ["{projectRoot}/**/*"], // every file in the project
    "production": ["default", "!{projectRoot}/**/*.spec.tsx"] // except test files
  },
  "targets": {
    "build": {
      "inputs": [
        "production", // this project's production files
        { "externalDependencies": ["vite"] } // the version of the vite package
      ]
    }
  }
}
```

{% cards %}
{% card title="Inputs and Named Inputs Reference" type="documentation" description="Learn about all the possible settings for `inputs` and `namedInputs`" url="/reference/inputs" /%}
{% card title="Configure Inputs for Task Caching" type="documentation" description="This recipes walks you through a few examples of how to configure `inputs` and `namedInputs`" url="/recipes/running-tasks/configure-inputs" /%}
{% /cards %}

### Outputs

Targets may define outputs to tell Nx where the target is going to create file artifacts that Nx should cache. `"outputs": ["{workspaceRoot}/dist/libs/mylib"]` tells Nx where the `build` target is going to create file artifacts.

This configuration is usually not needed. Nx comes with reasonable defaults (imported in `nx.json`) which implement the configuration above.

Specifically, by default, the following locations are cached for builds:

- `{workspaceRoot}/dist/{projectRoot}`,
- `{projectRoot}/build`,
- `{projectRoot}/dist`,
- `{projectRoot}/public`

{% cards %}
{% card title="Configure Outputs for Task Caching" type="documentation" description="This recipes walks gives helpful tips to configure `outputs` for tasks" url="/recipes/running-tasks/configure-outputs" /%}
{% /cards %}

Read the [configure outputs for task caching](/recipes/running-tasks/configure-outputs) recipe for helpful tips for setting outputs.

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

But if the above is not possible, globs (parsed by the [GlobSet](https://docs.rs/globset/0.4.5/globset/#syntax) Rust library) can be specified as outputs to only cache a set of files rather than the whole directory.

```json
{
  "targets": {
    "build-js": {
      "outputs": ["{workspaceRoot}/dist/libs/mylib/**/*.{js,map}"]
    },
    "build-css": {
      "outputs": ["{workspaceRoot}/dist/libs/mylib/**/*.css"]
    }
  }
}
```

More advanced patterns can be used to exclude files and folders in a single line

```json
{
  "targets": {
    "build-js": {
      "outputs": ["{workspaceRoot}/dist/libs/!(cache|.next)/**/*.{js,map}"]
    },
    "build-css": {
      "outputs": ["{workspaceRoot}/dist/libs/mylib/**/!(secondary).css"]
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
{% tab label="Version 16+ (self)" %}

```json
{
  "targets": {
    "test": {
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
{% /tabs %}

#### Examples

You can write the shorthand configuration above in the object syntax like this:

{% tabs %}
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
{% /tabs %}

With the expanded syntax, you also have a third option available to configure how to handle the params passed to the target. You can either forward them or you can ignore them (default).

{% tabs %}
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
{% /tabs %}

This also works when defining a relation for the target of the project itself using `"projects": "self"`:

{% tabs %}
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

### Executor/command options

To define what a task does, you must configure which command or executor will run when the task is executed. In the case of [inferred tasks](/concepts/inferred-tasks) you can provide project-specific overrides. As an example, if your repo has projects with a `build` inferred target running the `vite build` command, you can provide some extra options as follows:

```json
{
  "targets": {
    "build": {
      "options": {
        "assetsInlineLimit": 2048,
        "assetsDir": "static/assets"
      }
    }
  }
}
```

For more details on how to pass args to the underlying command see the [Pass Args to Commands recipe](/recipes/running-tasks/pass-args-to-commands).

In the case of an explicit target using an executor, you can specify the executor and the options specific to that executor as follows:

```json
{
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "options": {
        "generateExportsField": true
      }
    }
  }
}
```

## Project Metadata

The following properties describe the project as a whole.

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
  "root": "libs/mylib",
  "tags": ["scope:myteam"]
}
```

{% /tab %}
{% /tabs %}

You can [configure lint rules using these tags](/features/enforce-module-boundaries) to, for instance, ensure that libraries
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
  "root": "libs/mylib",
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
  "root": "libs/mylib",
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
  "root": "libs/mylib",
  "implicitDependencies": ["shop-*"] # "mylib" depends on all projects beginning with "shop-"
}
```

{% /tab %}
{% /tabs %}

### Including package.json files as projects in the graph

Any `package.json` file that is referenced by the `workspaces` property in the root `package.json` file will be included as a project in the graph. If you are using Lerna, projects defined in `lerna.json` will be included. If you are using pnpm, projects defined in `pnpm-workspace.yml` will be included.

If you want to ignore a particular `package.json` file, exclude it from those tools. For example, you can add `!packages/myproject` to the `workspaces` property.

### Ignoring package.json scripts

Nx merges `package.json` scripts with any targets defined in `project.json`.
If you only wish for some scripts to be used as Nx targets, you can specify them in the `includedScripts` property of the project's `package.json`.

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

<!-- {% short-embeds %}
{% short-video
title="Two Places To Define Tasks"
embedUrl="https://www.youtube.com/embed/_oFHSXxa77E" /%}
{% short-video
title="Nx w/ Non-JS Languages?"
embedUrl="https://www.youtube.com/embed/VnIDJYqipdY" /%}
{% short-video
title="Running Many Tasks at Once"
embedUrl="https://www.youtube.com/embed/-lyN72D13uc" /%}
{% /short-embeds %} -->

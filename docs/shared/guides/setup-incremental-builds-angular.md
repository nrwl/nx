---
title: Setup Incremental Builds for Angular Applications
description: Learn how to configure your Angular applications in Nx to use incremental builds, improving build performance by only rebuilding what changed.
---

# Setup incremental builds for Angular applications

In this guide we'll specifically look into which changes need to be made to enable incremental builds for Angular
applications.

## Use buildable libraries

To enable incremental builds you need to use buildable libraries.

You can generate a new buildable library with:

```shell
nx g @nx/angular:lib libs/my-lib --buildable
```

The generated buildable library uses the `@nx/angular:ng-packagr-lite` executor which is optimized for the incremental
builds scenario:

```jsonc
{
  "projectType": "library",
  ...
  "targets": {
    "build": {
      "executor": "@nx/angular:ng-packagr-lite",
      "outputs": [
        "{workspaceRoot}/dist/libs/my-lib"
      ],
      "options": {
        ...
      },
      "configurations": {
        ...
      },
      "defaultConfiguration": "production"
    },
    ...
  },
  ...
},
```

{% callout type="warning" title="More details" %}
Please note that it is important to keep the `outputs` property in sync with the `dest` property in the file
`ng-package.json` located inside the library root. When a library is generated, this is configured correctly, but if the
path is later changed in `ng-package.json`, it needs to be updated as well in the project configuration.

The `@nx/angular:package` executor also supports incremental builds. It is used to build and package an Angular library
to be distributed as an NPM package following the Angular Package Format (APF) specification. It will be automatically
configured when generating a publishable library (`nx g @nx/angular:lib libs/my-lib --publishable --importPath my-lib`).
{% /callout %}

## Adjust the application executor

{% callout type="note" title="Angular Esbuild Performance" %}
From internal testing done at Nx, the build time saved from using incremental builds when using Esbuild with Angular is
not as effective as the time saved when using Webpack with Angular.
Angular's build time with Esbuild already provides a great performance boost and therefore overall time saved may not
warrant using incremental builds with Esbuild for Angular
{% /callout %}

Change your Angular application's "build" target executor to Nx's version of builder you're currently using and the "
serve" target executor to `@nx/angular:dev-server` as shown below.

- `@angular-devkit/build-angular:application` -> `@nx/angular:application`
- `@angular-devkit/build-angular:browser-esbuild` -> `@nx/angular:browser-esbuild`
- `@angular/build:browser` -> `@nx/angular:webpack-browser`

{% tabs %}
{% tab label="@angular-devkit/build-angular:application" %}

```jsonc {% fileName="project.json" %}
{
  "projectType": "application",
  ...
  "targets": {
    "build": {
      "dependsOn": ["^build"],
      "executor": "@nx/angular:application",
      "outputs": [
        "{options.outputPath}"
      ],
      "options": {
        "buildLibsFromSource": false
        ...
      },
      "configurations": {
        ...
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@nx/angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "buildLibsFromSource": false
      },
      "configurations": {
        "production": {
          "buildTarget": "my-app:build:production"
        }
      }
    },
    ...
  }
},
```

{% /tab %}
{% tab label="@angular-devkit/build-angular:browser-esbuild" %}

```jsonc {% fileName="project.json" %}
{
  "projectType": "application",
  ...
  "targets": {
    "build": {
      "dependsOn": ["^build"],
      "executor": "@nx/angular:browser-esbuild",
      "outputs": [
        "{options.outputPath}"
      ],
      "options": {
        "buildLibsFromSource": false
        ...
      },
      "configurations": {
        ...
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@nx/angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "buildLibsFromSource": false
      },
      "configurations": {
        "production": {
          "buildTarget": "my-app:build:production"
        }
      }
    },
    ...
  }
},
```

{% /tab %}
{% tab label="@angular-devkit/build-angular:browser" %}

```jsonc {% fileName="project.json" %}
{
  "projectType": "application",
  ...
  "targets": {
    "build": {
      "dependsOn": ["^build"],
      "executor": "@nx/angular:webpack-browser",
      "outputs": [
        "{options.outputPath}"
      ],
      "options": {
        "buildLibsFromSource": false
        ...
      },
      "configurations": {
        ...
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "executor": "@nx/angular:dev-server",
      "options": {
        "buildTarget": "my-app:build",
        "buildLibsFromSource": false
      },
      "configurations": {
        "production": {
          "buildTarget": "my-app:build:production"
        }
      }
    },
    ...
  }
},
```

{% /tab %}
{% /tabs %}

### Add Executor to Target Defaults

If you'd like to avoid adding `"dependsOn": ["^build"]` to every application in your workspace that uses one of the
required executors you can add it to the `targetDefaults` section of the `nx.json`:

{% tabs %}
{% tab label="@nx/angular:application" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "@nx/angular:application": {
      "dependsOn": ["^build"]
    }
  }
}
```

{% /tab %}
{% tab label="@nx/angular:browser-esbuild" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "@nx/angular:browser-esbuild": {
      "dependsOn": ["^build"]
    }
  }
}
```

{% /tab %}
{% tab label="@nx/angular:webpack-browser" %}

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "@nx/angular:webpack-browser": {
      "dependsOn": ["^build"]
    }
  }
}
```

{% /tab %}
{% /tabs %}

## Running and serving incremental builds

To build an application incrementally use the following command:

```shell
nx build my-app --parallel
```

To serve an application incrementally use this command:

```shell
nx serve my-app
```

### Build target name

It is required to use the same target name for the build target (target using one of the executors that support
incremental builds: `@nx/angular:application`, `@nx/angular:browser-esbuild`, `@nx/angular:webpack-browser`,
`@nx/angular:package` and `@nx/angular:ng-packagr-lite`) in the
project being built and the buildable libraries it depends on. The executors that support incremental builds rely on the
build target name of the project to identify which of the libraries it depends on are buildable.

If you need to have a different build target name for an application (or library) build (e.g. when composing different
targets), you need to make sure the build target name of all the relevant projects is the same.

Say you have the same application above with a configuration as follows:

```jsonc {% fileName="project.json" %}
{
  "projectType": "application",
  ...
  "targets": {
    "build-base": {
      "executor": "@nx/angular:webpack-browser",
      "outputs": [
        "{options.outputPath}"
      ],
      "options": {
        "buildLibsFromSource": false
        ...
      },
      "configurations": {
        ...
      }
    },
    "build": {
      "executor": "nx:run-commands",
      "outputs": [
        "{options.outputPath}"
      ],
      "options": {
        "commands": [
          "node ./tools/scripts/important-script.js",
          "node ./tools/scripts/another-important-script.js"
        ],
        ...
      },
      "configurations": {
        ...
      }
    },
    "serve": {
      "executor": "@nx/angular:dev-server",
      "options": {
        "buildTarget": "my-app:build-base",
        "buildLibsFromSource": false
      },
      "configurations": {
        "production": {
          "buildTarget": "my-app:build-base:production"
        }
      }
    },
    ...
  }
},
```

And the `targetDefaults` configured in the `nx.json` as:

```json
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["build-base"]
    },
    "build-base": {
      "dependsOn": ["^build-base"]
    }
  }
}
```

The build target name of the application is `build-base`. Therefore, the build target name of the buildable libraries it
depends on must also be `build-base`:

```jsonc
{
  "projectType": "library",
  ...
  "targets": {
    "build-base": {
      "executor": "@nx/angular:ng-packagr-lite",
      "outputs": [
        "{workspaceRoot}/dist/libs/my-lib"
      ],
      "options": {
        ...
      },
      "configurations": {
        ...
      },
      "defaultConfiguration": "production"
    },
    ...
  },
  ...
},
```

## Example repository

Check out the [nx-incremental-large-repo](https://github.com/nrwl/nx-incremental-large-repo) for a live example.

{% github-repository url="https://github.com/nrwl/nx-incremental-large-repo" /%}

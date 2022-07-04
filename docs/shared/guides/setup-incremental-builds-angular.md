# Setup incremental builds for Angular applications

In this guide we’ll specifically look into which changes need to be made to enable incremental builds for Angular
applications.

{% callout type="caution" title="Nx > 10.4.0" %}
Incremental builds requires Nx version 10.4.0 or later.
{% /callout %}

## Requirements

It’s required that you run the Angular compatibility compiler (`ngcc`) after every package installation if you have Ivy
enabled. This comes configured by default in every Nx workspace. The incremental build relies on the fact that `ngcc`
must have already been run. You can check your `package.json` and make sure you have the following:

```json
{
  ...
  "scripts": {
    ...
    "postinstall": "ngcc --properties es2015 browser module main",
    ...
  }
  ...
}
```

{% callout type="warning" title="ngcc limitations" %}
Please note that `ngcc` doesn’t support `pnpm` ([#32087](https://github.com/angular/angular/issues/32087#issuecomment-523225437) and [#38023](https://github.com/angular/angular/issues/38023#issuecomment-732423078)), so you need to use either `yarn` or `npm`.
{% /callout %}

## Use buildable libraries

To enable incremental builds you need to use buildable libraries.

You can generate a new buildable library with:

```bash
nx g @nrwl/angular:lib my-lib --buildable
```

The generated buildable library uses the `@nrwl/angular:ng-packagr-lite` executor which is optimized for the incremental
builds scenario:

```json
{
  "projectType": "library",
  ...
  "targets": {
    "build": {
      "executor": "@nrwl/angular:ng-packagr-lite",
      "outputs": [
        "dist/libs/my-lib"
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
Please note that it is important to keep the `outputs` property in sync with the `dest` property in the file `ng-package.json` located inside the library root. When a library is generated, this is configured correctly, but if the path is later changed in `ng-package.json`, it needs to be updated as well in the project configuration.

The `@nrwl/angular:package` executor also supports incremental builds. It is used to build and package an Angular library to be distributed as an NPM package following the Angular Package Format (APF) specification. It will be automatically configured when generating a publishable library (`nx g @nrwl/angular:lib my-lib --publishable --importPath my-lib`).
{% /callout %}

## Adjust the application executor

Change your Angular application’s "build" target executor to `@nrwl/angular:webpack-browser` and the "serve" target
executor to `@nrwl/web:file-server` as shown below:

```json
{
  "projectType": "application",
  ...
  "targets": {
    "build": {
      "executor": "@nrwl/angular:webpack-browser",
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
      "executor": "@nrwl/web:file-server",
      "options": {
        "buildTarget": "my-app:build"
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

## Running and serving incremental builds

To build an application incrementally use the following command:

```bash
nx build my-app --parallel
```

To serve an application incrementally use this command:

```bash
nx serve my-app --parallel
```

Note: you can specify the `--parallel` flags as part of the options property on the file-server executor in
your `project.json` file. The file-server executor will pass those to the `nx build` command it invokes.

```json
{
  "projectType": "application",
  ...
  "targets": {
    "build": {
      "executor": "@nrwl/angular:webpack-browser",
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
    "serve": {
      "executor": "@nrwl/web:file-server",
      "options": {
        "buildTarget": "my-app:build",
        "parallel": true
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

### Build target name

It is required to use the same target name for the build target (target using one of the executors that support
incremental builds: `@nrwl/angular:webpack-browser`, `@nrwl/angular:package` and `@nrwl/angular:ng-packagr-lite`) in the
project being built and the buildable libraries it depends on. The executors that support incremental builds rely on the
build target name of the project to identify which of the libraries it depends on are buildable.

If you need to have a different build target name for an application (or library) build (e.g. when composing different
targets), you need to make sure the build target name of all the relevant projects is the same.

Say you have the same application above with a configuration as follows:

```json
{
  "projectType": "application",
  ...
  "targets": {
    "build-base": {
      "executor": "@nrwl/angular:webpack-browser",
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
      "executor": "@nrwl/workspace:run-commands",
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
      "executor": "@nrwl/web:file-server",
      "options": {
        "buildTarget": "my-app:build-base",
        "parallel": true
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

```json
{
  "projectType": "library",
  ...
  "targets": {
    "build-base": {
      "executor": "@nrwl/angular:ng-packagr-lite",
      "outputs": [
        "dist/libs/my-lib"
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

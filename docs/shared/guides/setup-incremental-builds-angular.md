# Setup incremental builds for Angular applications

In this guide we’ll specifically look into which changes need to be made to enable incremental builds for Angular
applications.

{% callout type="caution" title="Nx > 10.4.0" %}
Incremental builds requires Nx version 10.4.0 or later.
{% /callout %}

## Requirements

If your library consumes any Angular package that has not been compiled with Ivy, you must ensure the
Angular compatibility compiler (`ngcc`) has run before building the library. The incremental build relies
on the fact that `ngcc` must have already been run. One way to do this is to run `ngcc` after every package
installation. You can check your `package.json` and make sure you have the following:

```jsonc {% fileName="package.json" %}
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

{% callout type="warning" title="PNPM support" %}
To use `ngcc` with `pnpm`, set [`node-linker=hoisted` in `.npmrc`](https://pnpm.io/npmrc#node-linker) and explicitly declare `node-gyp-build` in `package.json`
See [angular/angular#50735](https://github.com/angular/angular/issues/50735), [nrwl/nx#16319](https://github.com/nrwl/nx/issues/16319) and [parcel-bundler/watcher#142](https://github.com/parcel-bundler/watcher/issues/142) for more details.

```ini {% fileName=".npmrc" %}
node-linker=hoisted
```

```jsonc {% fileName="package.json" %}
{
  ...
  "devDependencies": {
    ...
    "node-gyp-build": "4.6.0",
    ...
  }
  ...
}
```

{% /callout %}

## Use buildable libraries

To enable incremental builds you need to use buildable libraries.

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [as-provided vs. derived documentation](/deprecated/as-provided-vs-derived) for more details.
{% /callout %}

You can generate a new buildable library with:

```shell
nx g @nx/angular:lib my-lib --directory=libs/my-lib --buildable
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
Please note that it is important to keep the `outputs` property in sync with the `dest` property in the file `ng-package.json` located inside the library root. When a library is generated, this is configured correctly, but if the path is later changed in `ng-package.json`, it needs to be updated as well in the project configuration.

The `@nx/angular:package` executor also supports incremental builds. It is used to build and package an Angular library to be distributed as an NPM package following the Angular Package Format (APF) specification. It will be automatically configured when generating a publishable library (`nx g @nx/angular:lib my-lib --publishable --importPath my-lib`).
{% /callout %}

## Adjust the application executor

Change your Angular application’s "build" target executor to `@nx/angular:webpack-browser` and the "serve" target
executor to `@nx/web:file-server` as shown below:

```jsonc
{
  "projectType": "application",
  ...
  "targets": {
    "build": {
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
      "executor": "@nx/web:file-server",
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

```shell
nx build my-app --parallel
```

To serve an application incrementally use this command:

```shell
nx serve my-app --parallel
```

{% callout type="note" title="Project configuration option" %}
You can specify the `--parallel` flags as part of the options property on the file-server executor in
your `project.json` file. The file-server executor will pass those to the `nx build` command it invokes.
{% /callout %}

```jsonc
{
  "projectType": "application",
  ...
  "targets": {
    "build": {
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
    "serve": {
      "executor": "@nx/web:file-server",
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
incremental builds: `@nx/angular:webpack-browser`, `@nx/angular:package` and `@nx/angular:ng-packagr-lite`) in the
project being built and the buildable libraries it depends on. The executors that support incremental builds rely on the
build target name of the project to identify which of the libraries it depends on are buildable.

If you need to have a different build target name for an application (or library) build (e.g. when composing different
targets), you need to make sure the build target name of all the relevant projects is the same.

Say you have the same application above with a configuration as follows:

```jsonc
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
      "executor": "@nx/web:file-server",
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

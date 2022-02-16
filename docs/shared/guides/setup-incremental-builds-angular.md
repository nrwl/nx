# Setup incremental builds for Angular applications

In this guide we’ll specifically look into which changes need to be made to enable incremental builds for Angular applications.

> Incremental builds requires Nx version 10.4.0 or later.

## Requirements

It’s required that you run the Angular compatibility compiler (`ngcc`) after every package installation if you have Ivy enabled. This comes configured by default in every Nx workspace. The incremental build relies on the fact that `ngcc` must have already been run. You can check your `package.json` and make sure you have the following:

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

> Please note that `ngcc` doesn’t support `pnpm` ([#32087](https://github.com/angular/angular/issues/32087#issuecomment-523225437) and [#38023](https://github.com/angular/angular/issues/38023#issuecomment-732423078)), so you need to use either `yarn` or `npm`.

## Use buildable libraries

To enable incremental builds you need to use buildable libraries.

You can generate a new buildable library with:

```bash
nx g @nrwl/angular:lib mylib --buildable
```

The generated buildable library uses the `@nrwl/angular:ng-packagr-lite` executor which is optimized for the incremental builds scenario:

```json
"mylib": {
    "projectType": "library",
    ...
    "architect": {
        "build": {
            "builder": "@nrwl/angular:ng-packagr-lite",
            "outputs": ["dist/libs/mylib"],
            "options": {...},
            "configurations": {...}
        },
        "lint": {...},
        "test": {...}
    },
   ...
},
```

> Please note that it is important to keep the `outputs` property in sync with the `dest` property in the file `ng-package.json` located inside the library root. When a library is generated, this is configured correctly, but if the path is later changed in `ng-package.json`, it needs to be updated as well in the project configuration.

## Adjust the app executor

Change your Angular app’s “build” target executor to `@nrwl/angular:webpack-browser` and the “serve” target executor to `@nrwl/web:file-server` as shown below:

```json
"app0": {
    "projectType": "application",
    ...
    "architect": {
        "build": {
            "builder": "@nrwl/angular:webpack-browser",
            "outputs": ["{options.outputPath}"],
            "options": { ... }
            "configurations": { ... }
        },
        "serve": {
            "builder": "@nrwl/web:file-server",
            "options": {
                "buildTarget": "app0:build"
            },
            "configurations": {
                "production": {
                    "buildTarget": "app0:build:production"
                }
            }
        },
        ...
    }
},
```

## Running and serving incremental builds

To build an app incrementally use the following command:

```bash
nx build myapp --with-deps --parallel
```

To serve an app incrementally use this command:

```bash
nx serve myapp --with-deps --parallel
```

Note: you can specify the `--with-deps` and `--parallel` flags as part of the options property on the file-server executor in your `project.json` file. The file-server executor will pass those to the `nx build` command it invokes.

```json
{
    "projectType": "application",
    ...
    "targets": {
        "build": {
            "executor": "@nrwl/angular:webpack-browser",
            "outputs": ["{options.outputPath}"],
            "options": { ... }
            "configurations": { ... }
        },
        "serve": {
            "executor": "@nrwl/web:file-server",
            "options": {
                "buildTarget": "app0:build",
                "withDeps": true,
                "parallel": true
            },
            "configurations": {
                "production": {
                    "buildTarget": "app0:build:production"
                }
            }
        },
        ...
    }
},
```

## Example repository

Check out the [nx-incremental-large-repo](https://github.com/nrwl/nx-incremental-large-repo) for a live example.

# Setup incremental builds for Angular applications

In this guide we’ll specifically look into which changes need to be made to enable [incremental builds](/angular/ci/incremental-builds) for Angular applications.  
Incremental builds require @nrwl/angular:webpack-browser, which requires Nx version 10.4.0 or later.

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
You can generate a new buildable lib with

```bash
nx g @nrwl/angular:lib mylib --buildable
```

## Adjust the executors/builders

Nx comes with faster executors allowing for a faster build. Make sure that your libraries use the @nrwl/angular:ng-packagr-lite builder.

```json
"mylib": {
    "projectType": "library",
    ...
    "architect": {
        "build": {
            "builder": "@nrwl/angular:ng-packagr-lite",
            "options": {...},
            "configurations": {...}
        },
        "lint": {...},
        "test": {...}
    },
   ...
},
```

Change your Angular app’s executor to @nrwl/angular:webpack-browser and the “serve” executor to @nrwl/web:file-server instead.

```json
"app0": {
    "projectType": "application",
    ...
    "architect": {
        "build": {
            "builder": "@nrwl/angular:webpack-browser",
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

To build an app incrementally use the following commands.

```bash
nx build myapp --with-deps --parallel
```

To serve an app incrementally use this command:

```bash
nx serve myapp --with-deps --parallel
```

Note: you can specify the `--with-deps` and `--parallel` flags as part of the options property on the file-server executor in your `angular.json` or `workspace.json`. The file-server executor will pass those to the `nx build` command it invokes.

```json
"app0": {
    "projectType": "application",
    ...
    "architect": {
        "build": {
            "builder": "@nrwl/angular:webpack-browser",
            "options": { ... }
            "configurations": { ... }
        },
        "serve": {
            "builder": "@nrwl/web:file-server",
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

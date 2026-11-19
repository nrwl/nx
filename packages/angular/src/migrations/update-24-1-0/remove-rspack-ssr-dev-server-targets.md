#### Remove SSR dev server targets that can't run in Rspack projects

Nx left a `serve-ssr` target on Angular applications that it created with Rspack and server-side rendering, or converted from webpack to Rspack.
The target uses the `@angular-devkit/build-angular:ssr-dev-server` builder and points at a `server` target that the Rspack setup doesn't have, so running it fails.
To serve an Rspack application, run `nx serve <project>`.

This migration removes a target from a project when all of these hold:

- The project root has an `rspack.config` file with a `.js`, `.ts`, `.mjs`, `.mts`, `.cjs`, or `.cts` extension.
- The target uses the `@angular-devkit/build-angular:ssr-dev-server` builder, set on the target or by a `targetDefaults` entry in `nx.json`.
- Every `serverTarget` in the target options and configurations names a target that doesn't exist, including configurations that `targetDefaults` adds.

The migration keeps a target when any `serverTarget` names an existing target, including one that a plugin infers, or when the target sets no `serverTarget`.
It also keeps a target that both the project's `project.json` and its `package.json` declare, because it changes only `project.json`.
It doesn't change references to a removed target, such as a `dependsOn` entry or a `package.json` script.
Nx skips a `dependsOn` entry that names a target the project doesn't have.

#### Sample code changes

##### Before

```json title="apps/app1/project.json"
{
  // ...
  "targets": {
    "serve-ssr": {
      "continuous": true,
      "readyWhen": {
        "signal": true
      },
      "executor": "@angular-devkit/build-angular:ssr-dev-server",
      "defaultConfiguration": "development",
      "configurations": {
        "development": {
          "browserTarget": "app1:build:development",
          "serverTarget": "app1:server:development"
        },
        "production": {
          "browserTarget": "app1:build:production",
          "serverTarget": "app1:server:production"
        }
      }
    },
    "serve": {
      "options": {
        "port": 4200
      }
    }
  }
}
```

##### After

```json title="apps/app1/project.json"
{
  // ...
  "targets": {
    "serve": {
      "options": {
        "port": 4200
      }
    }
  }
}
```

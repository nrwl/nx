---
title: JS Node executor examples
description: This page contains examples for the @nx/js:node executor.
---

The `@nx/js:node` executor runs the output of a build target. For example, an application uses esbuild ([`@nx/esbuild:esbuild`](/nx-api/esbuild/executors/esbuild)) to output the bundle to `dist/my-app` folder, which can then be executed by `@nx/js:node`.

`project.json`:

```json
"my-app": {
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "buildTarget": "my-app:build"
      }
    },
    "build": {
      "executor": "@nx/esbuild:esbuild",
      "options": {
        "main": "my-app/src/main.ts",
        "output": ["dist/my-app"],
        //...
      }
    },
  }
}
```

```bash
npx nx serve my-app
```

## Examples

{% tabs %}
{% tab label="Pass extra Node CLI arguments" %}

Using `runtimeArgs`, you can pass arguments to the underlying `node` command. For example, if you want to set [`--no-warnings`](https://nodejs.org/api/cli.html#--no-warnings) to silence all Node warnings, then add the following to the `project.json` file.

```json
"my-app": {
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "runtimeArgs": ["--no-warnings"],
        //...
      },
    },
  }
}
```

{% /tab %}

{% tab label="Run all task dependencies" %}

If your application build depends on other tasks, and you want those tasks to also be executed, then set the `runBuildTargetDependencies` to `true`. For example, a library may have a task to generate GraphQL schemas, which is consume by the application. In this case, you want to run the generate task before building and running the application.

This option is also useful when the build consumes a library from its output, not its source. For example, if an executor that supports `buildLibsFromSource` option has it set to `false` (e.g. [`@nx/webpack:webpack`](/nx-api/webpack/executors/webpack)).

Note that this option will increase the build time, so use it only when necessary.

```json
"my-app": {
  "targets": {
    "serve": {
      "executor": "@nx/js:node",
      "options": {
        "runBuildTargetDependencies": true,
        //...
      },
    },
  }
}
```

{% /tab %}

{% /tabs %}

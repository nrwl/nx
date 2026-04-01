---
title: Enable TypeScript Batch Mode
description: Use the @nx/js:tsc batch implementation to compile multiple TypeScript projects in a single process, reducing build times for large workspaces.
sidebar:
  label: Enable Typescript Batch Mode
filter: 'type:Guides'
---

{% aside type="tip" title="Available since Nx 16.6.0" %}
The `@nx/js:tsc` batch implementation was introduced in Nx **16.6.0**.
{% /aside %}

If you're using `@nx/js:tsc` to build your projects, you can opt in to its batch implementation. It uses the [TypeScript APIs for incremental builds](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript) to batch task execution into a single process, which is faster than the default one-process-per-task approach. The larger the task graph, the bigger the speedup.

{% aside type="caution" title="Experimental feature" %}
Executing tasks in batch mode is an experimental feature.
{% /aside %}

{% aside type="note" title="Requirements" %}
Building a project with the `@nx/js:tsc` executor in batch mode requires all dependent projects (excluding implicit dependencies) to be buildable and built using the `@nx/js:tsc` executor.
{% /aside %}

To run your builds using the batch implementation, pass in `--batch` flag:

```shell
nx build my-project --batch
```

For optimal performance, you could set the `clean` option to `false`. Otherwise, the executor cleans the output folder before running the build, which results in the loss of the [`.tsbuildinfo` file](https://www.typescriptlang.org/tsconfig/#tsBuildInfoFile) and, consequently, the loss of important optimizations performed by TypeScript. This is not a requirement. Even if the `clean` option is not set to `false` there are other important optimizations that are performed by the batch implementation.

```json
// libs/ts-lib/project.json
{
  "build": {
    "executor": "@nx/js:tsc",
    "options": {
      "outputPath": "dist/libs/ts-lib",
      "main": "libs/ts-lib/src/index.ts",
      "tsConfig": "libs/ts-lib/tsconfig.lib.json",
      "assets": ["libs/ts-lib/*.md"],
      "clean": false
    }
  }
}
```

You can get a sense of the performance improvements over using the `@nx/js:tsc` default implementation in the [tsc batch mode benchmark](/docs/reference/benchmarks/tsc-batch-mode).

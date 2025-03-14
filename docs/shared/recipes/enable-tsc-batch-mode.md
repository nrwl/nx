---
title: Enable TypeScript Batch Mode
description: Learn how to use TypeScript's batch mode in Nx to significantly improve build performance by batching TypeScript compilation tasks into a single process.
---

# Enable Typescript Batch Mode

{% callout type="check" title="Available since Nx 16.6.0" %}
The `@nx/js:tsc` batch implementation was introduced in Nx **16.6.0**.
{% /callout %}

If you're using the `@nx/js:tsc` to build your projects, you can opt-in to use its batch implementation. The batch implementation uses the [TypeScript APIs for incremental builds](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript) and batches the execution of the tasks into a single process. This results in a much faster build time when compared to the default implementation (the bigger the task graph to run, the more the performance improvements).

{% callout type="warning" title="Experimental feature" %}
Executing tasks in batch mode is an experimental feature.
{% /callout %}

{% callout type="info" title="Requirements" %}
Building a project with the `@nx/js:tsc` executor in batch mode requires all dependent projects (excluding implicit dependencies) to be buildable and built using the `@nx/js:tsc` executor.
{% /callout %}

To run your builds using the batch implementation, pass in `--batch` flag:

```shell
nx build my-project --batch
```

For optimal performance, you could set the `clean` option to `false`. Otherwise, the executor cleans the output folder before running the build, which results in the loss of the [`.tsbuildinfo` file](https://www.typescriptlang.org/tsconfig/#tsBuildInfoFile) and, consequently, the loss of important optimizations performed by TypeScript. This is not a requirement. Even if the `clean` option is not set to `false` there are other important optimizations that are performed by the batch implementation.

```json {% fileName="libs/ts-lib/project.json" %}
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

You can get a sense of the performance improvements over using the `@nx/js:tsc` default implementation in the [tsc batch mode benchmark](/showcase/benchmarks/tsc-batch-mode).

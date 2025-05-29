---
title: 'TSC Batch Mode'
description: 'Learn how Nx TSC batch mode dramatically improves TypeScript compilation speed by leveraging project references and incremental builds while maintaining DX.'
---

# TSC Batch Mode

![Side by side demo of normal tsc taking 1m48s and batch mode tsc taking 28s](/shared/images/benchmarks/ts-benchmark.gif)

This repo compares two modes of running the `@nx/js:tsc` executor: the regular one and the batch one. The batch implementation, apart from running multiple tasks in a single process, also creates the required [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html) on the fly to perform incremental builds.

{% github-repository url="https://github.com/nrwl/large-ts-monorepo" /%}

{% callout type="note" title="Potential speed improvement" %}
Depending on the use case, batch mode compilation is from 1.16 to 7.73 times faster. More details on the exact scenarios tested can be found in the [repository `README.md` file](https://github.com/nrwl/large-ts-monorepo).
{% /callout %}

## Why is the batch implementation faster?

The non-batch implementation runs each task in a separate process. Each process creates a new `ts.Program` instance and performs a full build. Creating a full `ts.Program` instance is an expensive operation. Creating processes and `ts.Program` comes with a lot of overhead. Thanks to the project graph, this is already improved by orchestrating tasks and running them in parallel. Still, there's only so much that can be run in parallel and the more deeply nested the dependencies are, the less parallelism we can achieve.

The batch implementation runs multiple tasks in a single process. This reduces the overhead of starting a new process for each task. It also creates the required [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html) (based on the project graph information) on the fly to perform [incremental builds](https://www.typescriptlang.org/docs/handbook/project-references.html#build-mode-for-typescript). This is what yields the main performance benefits over the non-batch implementation. In this mode, the TypeScript compiler doesn't create a full `ts.Program` per project. Instead, it acts more like a build orchestrator and runs only out-of-date projects in the correct order.

## Compatible with Nx caching and distributed task execution 🏎️

TSC has powerful capabilities for incremental builds. Nx has powerful capabilities for caching and task distribution. These features compose very nicely. First Nx will retreive whatever it can from its local and remote caches (which includes `.tsbuildinfo` files), and then TSC will compile the remaining libs using the cached `.tsbuildinfo` files. This results in the minimum amount of computation.

Note even though the batch implementation can compile hundreds of libraries in the same process, each compiled library will be cached separately by Nx, which greatly increase computation reuse and the percentage of cache hits.

## Performance and DX balance

In large monorepos, it can be challenging to maintain Project references required for TSC incremental builds. Developers need to manually keep those references up to date, which is error-prone and can lead to broken builds.

The `@nx/js:tsc` batch implementation addresses this by creating the required project references on the fly using the project graph information. Nx already knows how your projects relate, so no need to tell it again. This eliminates the need for developers to manually maintain the project references while still getting the performance benefits of incremental builds. Zero DX cost, huge perf benefits.

## See Also

- [Enable Typescript Batch Mode](/technologies/typescript/recipes/enable-tsc-batch-mode)

---
title: Building blocks of fast CI
description: Learn how affected tasks, caching, parallelism, and distribution work together to reduce CI time.
filter: 'type:Concepts'
---

Fast CI starts with three layers:

- Fast individual tasks
- Less unnecessary work
- Enough compute to run independent tasks concurrently

Nx plugins, the project graph, task orchestration, and Nx Cloud address those layers together.

## Use fast tools

A CI pipeline runs tasks such as `build`, `test`, `lint`, and `e2e`.
The tools behind those tasks set the minimum execution time for a cache miss.
Use current tools and configuration before adding more CI machines.

Nx can run tasks for any technology.
Plugins provide deeper integrations for tools such as
[Vite](/docs/technologies/build-tools/vite/introduction) and
[Vitest](/docs/technologies/test-tools/vitest/introduction), along with frameworks.
Plugin migrations can update tool configuration when recommended settings change.
The common plugin interface also makes it practical to compare tools without replacing Nx task
orchestration.

Browse the [plugin registry](/docs/plugin-registry) for prebuilt integrations.

## Reduce unnecessary work

Most pull requests in a monorepo don't affect every project.
Use [`nx affected`](/docs/features/ci-features/affected) to run tasks only for projects affected by a
change and projects that depend on them.

Some affected tasks may have already run with the same inputs.
[Remote caching](/docs/features/ci-features/remote-cache) lets developer machines and CI jobs share
those results, so Nx can restore terminal output and artifacts instead of repeating the task.

Affected calculations reduce the task graph before execution.
Caching removes repeated work from the remaining graph.
For a scenario-by-scenario explanation, see [reduce waste in CI](/docs/kb/reduce-waste).

## Parallelize and distribute tasks

Nx runs independent tasks in parallel while respecting
[task pipeline](/docs/concepts/task-pipeline-configuration) dependencies.
Set a workspace-wide limit with `parallel` in `nx.json`, or pass `--parallel=<number>` for one run.
One machine keeps logs and artifacts in one place, but its CPU and memory cap how much can run at
once, so CI duration grows once the task graph outgrows it.

The usual next step is static partitioning (binning and sharding), splitting work across CI jobs by hand, often one job per target, with slow test suites split into shards:

![CI tasks divided into fixed bins](../../../../assets/concepts/ci-concepts/binning.svg)

Static partitions finish at different times and leave machines idle.
A task in one partition can depend on a task in another, so scripts have to coordinate order and cache
availability, and the right split changes every time the project graph does.

Nx Agents replace static partitioning with dynamic
assignment.
The main job keeps the same Nx commands it runs on one machine, and ready tasks from the task graph go
to whichever agent has room.
With [_dynamic task packing_](/docs/features/ci-features/distribute-task-execution#how-dynamic-task-packing-works), that decision uses each task's past duration and CPU and memory use.
Remote caching moves artifacts between agents, and logs and outputs come back to the main job.

![CI tasks distributed across three agents](../../../../assets/concepts/ci-concepts/3agents.svg)

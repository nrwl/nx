# Database Cache

In version 20, Nx uses a database to store metadata in the local cache. This change provides the following benefits:

1. Faster caching
2. More efficient task running
3. Safer cache storage
4. Unlocked potential features

## 1. Faster Caching

Nx stores task output files on the file system but, with the database cache, it stores hashed inputs and metadata about task executions in a database. Reading from and writing to a database is faster than reading from and writing to the filesystem, especially when there is more content to parse through. Every time Nx runs a task, it will compare the hashed inputs with all the previous task executions in the cache. This is the process that the database cache makes faster. This check will happen whether the task execution ends up being a cache hit or a cache miss, so both scenarios benefit.

## 2. More Efficient Task Running

Nx is configured by default to run up to 3 tasks in parallel in separate processes on your machine. Nx uses the dependency structure of your tasks to make sure that each task has all of its prerequisites before it is executed. This guarantees that the output of the tasks will be correct, but not that the tasks will complete in the fastest time possible. Consider the following scenario:

Let's say the build of `my-app` depends on `lib1`, `lib2`, `lib3` and `lib4`. If the builds for `lib1`, `lib2` and `lib3` typically take 5 seconds each and the build for `lib4` takes 20 seconds, we know as humans that the build for `lib4` should be started as soon as possible and the other libraries can be executed as processes become available.

The key phrase in this scenario is "typically takes". With the database cache, Nx tracks historical timing data for tasks that are run on your machine so that it knows how long tasks "typically take" to execute. Using this knowledge, it will prioritize starting longer tasks sooner so that the overall process finishes more quickly.

## 3. Safer Cache Storage

It is easier for bad actors to change data on your file system than it is for them to change data in a database. If a bad actor gained access to the cache metadata, they could change the hashes so that your tasks use their cached output instead of the correct output. This would mean that any future tasks or users that consumed that output would be exposed to the bad actors output instead of the output you intended.

## 4. Unlocked Potential Features

Using a database to store the task metadata opens up a lot of possibilities for aggregation and analytics. We could use the task timings to help you identify which tasks to prioritize for performance tweaks because of how frequently they are executed and how long the tasks take to run. We could identify tasks that should have their inputs fine-tuned because they have a low cache hit rate.

## Opting Out

In Nx 21, the database cache will be the only option, but until then, you can choose to use the legacy file system cache by setting the `useLegacyCache` property in your `nx.json` file.

```json {% fileName="nx.json" %}
{
  "useLegacyCache": true
}
```

// Intentionally (almost) empty. The deprecated `initTasksRunner` programmatic
// API was removed from this entrypoint in Nx 23 (#35708). However, the Nx Cloud
// agent client still does `require('nx/src/index')` as its first probe before
// falling back to the modern `runDiscreteTasks` / `runContinuousTasks` API. If
// this file is missing entirely, that `require` throws and aborts the cloud
// client's task-runner setup, surfacing as "runContinuousTasks is not a function".
// Keep this as a valid (empty) ES module so the `nx/src/index` entrypoint keeps
// resolving (via the `./src/*` mapping in package.json -> dist/src/index.js).
export {};

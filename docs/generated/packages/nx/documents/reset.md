---
title: 'reset - CLI command'
description: 'Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.'
---

# reset

Clears cached Nx artifacts and metadata about the workspace and shuts down the Nx Daemon.

## Usage

```shell
nx reset
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Clears the internal state of the daemon and metadata that Nx is tracking. Helpful if you are getting strange errors and want to start fresh:

```shell
 nx reset
```

Clears the Nx Cache directory. This will remove all local cache entries for tasks, but will not affect the remote cache:

```shell
 nx reset --only-cache
```

Stops the Nx Daemon, it will be restarted fresh when the next Nx command is run.:

```shell
 nx reset --only-daemon
```

Clears the workspace data directory. Used by Nx to store cached data about the current workspace (e.g. partial results, incremental data, etc):

```shell
 nx reset --only-workspace-data
```

## Options

### help

Type: `boolean`

Show help

### onlyCache

Type: `boolean`

Clears the Nx cache directory. This will remove all local cache entries for tasks, but will not affect the remote cache.

### onlyDaemon

Type: `boolean`

Stops the Nx Daemon, it will be restarted fresh when the next Nx command is run.

### onlyWorkspaceData

Type: `boolean`

Clears the workspace data directory. Used by Nx to store cached data about the current workspace (e.g. partial results, incremental data, etc)

### version

Type: `boolean`

Show version number

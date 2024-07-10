---
title: 'sync - CLI command'
description: 'Sync the workspace configuration by running the registered sync generators.'
---

# sync

Sync the workspace configuration by running the registered sync generators.

## Usage

```shell
nx sync
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Check if the workspace is in sync without making changes. It throws an error and exits with a non-zero status code if the workspace is not in sync:

```shell
 nx sync --check
```

## Options

### check

Type: `boolean`

Check if the workspace is in sync without making changes

### help

Type: `boolean`

Show help

### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number

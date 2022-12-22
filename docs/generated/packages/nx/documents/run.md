---
title: 'run - CLI command'
description: 'Runs an Architect target with an optional custom builder configuration defined in your project.'
---

# run

Runs an Architect target with an optional custom builder configuration defined in your project.

## Usage

```shell
nx run <target> [options]
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Run the `build` target for the `myapp` :

```shell
nx run myapp:build
```

Run the `build` target for the `myapp` project with a `production` configuration:

```shell
nx run myapp:build:production
```

## Options

### configuration (-c)

A named builder configuration, defined in the "configurations" section of the workspace configuration file. The builder uses the named configuration to run the given target.

### help

Show help

### version

Show version number

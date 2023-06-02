---
title: 'run - CLI command'
description: 'Runs a target defined for your project. Target definitions can be found in the `scripts` property of the project `package.json`, or in the `targets` property of the project `project.json` file.'
---

# run

Runs a target defined for your project. Target definitions can be found in the `scripts` property of the project `package.json`, or in the `targets` property of the project `project.json` file.

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

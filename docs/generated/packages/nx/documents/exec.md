---
title: 'exec - CLI command'
description: 'Executes any command as if it was a target on the project'
---

# exec

- Executes any command as if it was a target on the project
- Executes an arbitrary command in each package

## Usage

In package.json, adding a script with `nx exec` will run the command as if it is a target on that project:

```json
{
  "name": "myorg",
  "version": "0.0.1",
  "scripts": {
    "build": "nx exec -- <command> [..args]"
  }
}
```

It will run the command for `myorg`.

When run from the terminal, `nx exec` will run the command for all projects in the workspace:

```
nx exec -- <command> [..args] # runs the command in all projects
nx exec -- tsc
nx exec -- echo \$NX_PROJECT_NAME
nx exec -- echo \$NX_PROJECT_ROOT_PATH
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

## Examples

You can use `npm run <command>` for a project and leverage the caching by wrapping your command with `nx exec`.

For example, you can run `npm run docs` as a Nx target for `myorg`:

```
{
  "name": "myorg",
  "nx": {},
  "scripts": {
    "docs": "nx exec -- node ./scripts/some-script.js"
  }
}
```

You may also run a script located in the project directory for all projects:

```
nx exec -- node ./scripts/some-script.js
```

The name of the current project is available through the environment variable $NX_PROJECT_NAME:

```
nx exec -- echo \$NX_PROJECT_NAME
```

The location of current project is available through the environment variable $NX_PROJECT_ROOT_PATH:

```
nx exec -- echo \$NX_PROJECT_ROOT_PATH
```

## Options

### all

Type: `boolean`

Default: `true`

[deprecated] `run-many` runs all targets on all projects in the workspace if no projects are provided. This option is no longer required.

### exclude

Type: `string`

Exclude certain projects from being processed

### graph

Type: `string`

Show the task graph of the command. Pass a file path to save the graph data instead of viewing it in the browser.

### help

Type: `boolean`

Show help

### nxBail

Type: `boolean`

Default: `false`

Stop command execution after the first failed task

### nxIgnoreCycles

Type: `boolean`

Default: `false`

Ignore cycles in the task graph

### parallel

Type: `string`

Max number of parallel processes [default is 3]

### projects

Type: `string`

Projects to run. (comma/space delimited project names and/or patterns)

### runner

Type: `string`

This is the name of the tasks runner configured in nx.json

### skipNxCache

Type: `boolean`

Default: `false`

Rerun the tasks even when the results are available in the cache

### verbose

Type: `boolean`

Prints additional information about the commands (e.g., stack traces)

### version

Type: `boolean`

Show version number

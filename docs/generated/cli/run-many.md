---
title: 'run-many - CLI command'
description: 'Run target for multiple listed projects'
---

# run-many

Run target for multiple listed projects

## Usage

```bash
nx run-many
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Test all projects:

```bash
nx run-many --target=test --all
```

Test proj1 and proj2:

```bash
nx run-many --target=test --projects=proj1,proj2
```

Test proj1 and proj2 in parallel:

```bash
nx run-many --target=test --projects=proj1,proj2 --parallel=2
```

## Options

### all

Type: boolean

Run the target on all projects in the workspace

### configuration

Type: string

This is the configuration to use when performing tasks on projects

### exclude

Type: array

Default: []

Exclude certain projects from being processed

### help

Type: boolean

Show help

### ~~only-failed~~

Type: boolean

Default: false

**Deprecated:** The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.

Only run the target on projects which previously failed

### output-style

Type: string

Choices: [dynamic, static, stream, stream-without-prefixes]

Defines how Nx emits outputs tasks logs

### parallel

Type: string

Max number of parallel processes [default is 3]

### projects

Type: string

Projects to run (comma delimited)

### runner

Type: string

Override the tasks runner in `nx.json`

### skip-nx-cache

Type: boolean

Default: false

Rerun the tasks even when the results are available in the cache

### target

Type: string

Task to run for affected projects

### verbose

Print additional error stack trace on failure

### version

Type: boolean

Show version number

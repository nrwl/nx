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

_boolean_

Run the target on all projects in the workspace

### configuration

_string_

This is the configuration to use when performing tasks on projects

### exclude

_array_

Default:

Exclude certain projects from being processed

### help

_boolean_

Show help

### ~~only-failed~~

_boolean_

Default: false

**Deprecated:** The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.

Only run the target on projects which previously failed

### parallel

_string_

Max number of parallel processes [default is 3]

### projects

_string_

Projects to run (comma delimited)

### runner

_string_

Override the tasks runner in `nx.json`

### skip-nx-cache

_boolean_

Default: false

Rerun the tasks even when the results are available in the cache

### target

_string_

Task to run for affected projects

### verbose

Print additional error stack trace on failure

### version

_boolean_

Show version number

### ~~with-deps~~

_boolean_

Default: false

**Deprecated:** Configure target dependencies instead. It will be removed in v14.

Include dependencies of specified projects when computing what to run

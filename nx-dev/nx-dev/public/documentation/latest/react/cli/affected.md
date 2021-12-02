# affected

Run target for affected projects

## Usage

```bash
nx affected
```

[Install `nx` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Run custom target for all affected projects:

```bash
nx affected --target=custom-target
```

Run tests in parallel:

```bash
nx affected --target=test --parallel=5
```

Run the test target for all projects:

```bash
nx affected --target=test --all
```

Run tests for all the projects affected by changing the index.ts file:

```bash
nx affected --target=test --files=libs/mylib/src/index.ts
```

Run tests for all the projects affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected --target=test --base=main --head=HEAD
```

Run tests for all the projects affected by the last commit on main:

```bash
nx affected --target=test --base=main~1 --head=main
```

## Options

### all

All projects

### base

Base of the current branch (usually main)

### configuration

This is the configuration to use when performing tasks on projects

### exclude

Default: ``

Exclude certain projects from being processed

### files

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas

### head

Latest commit of the current branch (usually HEAD)

### help

Show help

### only-failed

Default: `false`

Isolate projects which previously failed

### parallel

Max number of parallel processes [default is 3]

### runner

This is the name of the tasks runner configured in nx.json

### skip-nx-cache

Default: `false`

Rerun the tasks even when the results are available in the cache

### target

Task to run for affected projects

### uncommitted

Uncommitted changes

### untracked

Untracked changes

### verbose

Print additional error stack trace on failure

### version

Show version number

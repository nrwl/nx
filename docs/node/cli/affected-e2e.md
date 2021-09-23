# affected:e2e

Run e2e tests for the applications affected by changes

## Usage

```bash
nx affected:e2e
```

[Install `nx` globally]({{framework}}/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Run tests in parallel:

```bash
nx affected:e2e --parallel --maxParallel=5
```

Rerun the test target only for the projects that failed last time:

```bash
nx affected:e2e --only-failed
```

Run the test target for all projects:

```bash
nx affected:e2e --all
```

Run tests for all the projects affected by changing the index.ts file:

```bash
nx affected:e2e --files=libs/mylib/src/index.ts
```

Run tests for all the projects affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected:e2e --base=main --head=HEAD
```

Run tests for all the projects affected by the last commit on main:

```bash
nx affected:e2e --base=main~1 --head=main
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

### maxParallel

Default: `3`

Max number of parallel processes. This flag is ignored if the parallel option is set to `false`.

### only-failed

Default: `false`

Isolate projects which previously failed

### parallel

Default: `false`

Parallelize the command

### runner

This is the name of the tasks runner configured in nx.json

### skip-nx-cache

Default: `false`

Rerun the tasks even when the results are available in the cache

### uncommitted

Uncommitted changes

### untracked

Untracked changes

### verbose

Print additional error stack trace on failure

### version

Show version number

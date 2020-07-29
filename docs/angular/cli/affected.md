# affected

Run task for affected projects

## Usage

```bash
nx affected
```

Install `nx` globally to invoke the command directly using `nx`, or use `npm run nx` or `yarn nx`.

### Examples

Run custom target for all affected projects:

```bash
nx affected --target=custom-target
```

Run tests in parallel:

```bash
nx affected --target=test --parallel --maxParallel=5
```

Rerun the test target only for the projects that failed last time:

```bash
nx affected --target=test --only-failed
```

Run the test target for all projects:

```bash
nx affected --target=test --all
```

Run the test target for the affected projects and also all the projects the affected projects depend on.:

```bash
nx affected --target=test --with-deps
```

Run tests for all the projects affected by changing the index.ts file:

```bash
nx affected --target=test --files=libs/mylib/src/index.ts
```

Run tests for all the projects affected by the changes between master and HEAD (e.g., PR):

```bash
nx affected --target=test --base=master --head=HEAD
```

Run tests for all the projects affected by the last commit on master:

```bash
nx affected --target=test --base=master~1 --head=master
```

Run build for all the projects affected by the last commit on master and their dependencies:

```bash
nx affected --target=build --base=master~1 --head=master --with-deps
```

## Options

### all

All projects

### base

Base of the current branch (usually master)

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

### plain

Produces a plain output for affected:apps and affected:libs

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

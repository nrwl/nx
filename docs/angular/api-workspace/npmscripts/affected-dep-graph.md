# affected:dep-graph

Graph dependencies affected by changes

## Usage

```bash
nx affected:dep-graph
```

Install `@nrwl/cli` globally to invoke the command directly using `nx`, or use `npm run nx` or `yarn nx`.

### Examples

Open the dep graph of the workspace in the browser, and highlight the projects affected by changing the index.ts file:

```bash
nx affected:dep-graph --files=libs/mylib/src/index.ts
```

Open the dep graph of the workspace in the browser, and highlight the projects affected by the changes between master and HEAD (e.g., PR):

```bash
nx affected:dep-graph --base=master --head=HEAD
```

Save the dep graph of the workspace in a json file, and highlight the projects affected by the changes between master and HEAD (e.g., PR):

```bash
nx affected:dep-graph --base=master --head=HEAD --file=output.json
```

Open the dep graph of the workspace in the browser, and highlight the projects affected by the last commit on master:

```bash
nx affected:dep-graph --base=master~1 --head=master
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

### file

output file (e.g. --file=output.json)

### files

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas

### filter

Use to limit the dependency graph to only show specific projects, list of projects delimited by commas.

### head

Latest commit of the current branch (usually HEAD)

### help

Show help

### only-failed

Default: `false`

Isolate projects which previously failed

### plain

Produces a plain output for affected:apps and affected:libs

### runner

This is the name of the tasks runner configured in nx.json

### uncommitted

Uncommitted changes

### untracked

Untracked changes

### verbose

Print additional error stack trace on failure

### version

Show version number

# dep-graph

Graph dependencies within workspace

## Usage

```bash
nx dep-graph
```

Install `@nrwl/cli` globally to invoke the command directly using `nx`, or use `npm run nx` or `yarn nx`.  
 ### Examples
Open the dep graph of the workspace in the browser:

```bash
nx dep-graph
```

Save the dep graph into a json file:

```bash
nx dep-graph --file=output.json
```

Save the dep graph into a html file:

```bash
nx dep-graph --file=output.html
```

## Options

### all

All projects

### base

Base of the current branch (usually master)

### exclude

Default: ``

Exclude certain projects from being processed

### file

output file (e.g. --file=.vis/output.json)

### files

A list of files delimited by commas

### head

Latest commit of the current branch (usually HEAD)

### help

Show help

### only-failed

Default: `false`

Isolate projects which previously failed

### uncommitted

Uncommitted changes

### untracked

Untracked changes

### verbose

Print additional error stack trace on failure

### version

Show version number

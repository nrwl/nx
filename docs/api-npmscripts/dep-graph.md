# dep-graph

Graph dependencies within workspace

## Usage

```bash
dep-graph
```

## Options

### help

Show help

### version

Show version number

### quiet

### parallel

Default: `false`

Parallelize the command

### maxParallel

Default: `3`

Max number of parallel processes

### files

A list of files delimited by commas

### uncommitted

Uncommitted changes

### untracked

Untracked changes

### all

All projects

### base

Base of the current branch (usually master)

### head

Latest commit of the current branch (usually HEAD)

### exclude

Default: ``

Exclude certain projects from being processed

### only-failed

Default: `false`

Isolate projects which previously failed

### file

output file (e.g. --file=.vis/output.json)

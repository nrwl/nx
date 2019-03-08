# affected:dep-graph

Graph dependencies affected by changes

## Usage

```bash
affected:dep-graph
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

### maxParallel

Default: `3`

Max number of parallel processes

### only-failed

Default: `false`

Isolate projects which previously failed

### parallel

Default: `false`

Parallelize the command

### quiet

### uncommitted

Uncommitted changes

### untracked

Untracked changes

### version

Show version number

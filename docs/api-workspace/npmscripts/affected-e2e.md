# affected:e2e

Run e2e tests for the applications affected by changes

## Usage

```bash
affected:e2e
```

## Options

### all

All projects

### base

Base of the current branch (usually master)

### exclude

Default: ``

Exclude certain projects from being processed

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

### uncommitted

Uncommitted changes

### untracked

Untracked changes

### verbose

Print additional error stack trace on failure

### version

Show version number

# workspace-schematic [name]

Runs a workspace schematic from the tools/schematics directory

## Usage

```bash
workspace-schematic [name]
```

## Options

### all

All projects

### apps-and-libs

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

### list-schematics

List the available workspace-schematics

### maxParallel

Default: `3`

Max number of parallel processes

### name

The name of your schematic`

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

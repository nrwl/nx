---
title: 'affected:graph - CLI command'
description: 'Graph dependencies affected by changes'
---

# affected:graph

Graph dependencies affected by changes

## Usage

```bash
nx affected:graph
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Open the project graph of the workspace in the browser, and highlight the projects affected by changing the index.ts file:

```bash
nx affected:graph --files=libs/mylib/src/index.ts
```

Open the project graph of the workspace in the browser, and highlight the projects affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected:graph --base=main --head=HEAD
```

Save the project graph of the workspace in a json file, and highlight the projects affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected:graph --base=main --head=HEAD --file=output.json
```

Generate a static website with project graph data in an html file, highlighting the projects affected by the changes between main and HEAD (e.g., PR):

```bash
nx affected:graph --base=main --head=HEAD --file=output.html
```

Open the project graph of the workspace in the browser, and highlight the projects affected by the last commit on main:

```bash
nx affected:graph --base=main~1 --head=main
```

Open the project graph of the workspace in the browser, highlight the projects affected, but exclude project-one and project-two:

```bash
nx affected:graph --exclude=project-one,project-two
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

### file

Output file (e.g. --file=output.json or --file=graph.html)

### files

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas

### focus

Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.

### groupByFolder

Group projects by folder in the project graph

### head

Latest commit of the current branch (usually HEAD)

### help

Show help

### host

Bind the project graph server to a specific ip address.

### only-failed

Default: `false`

Isolate projects which previously failed

### open

Default: `true`

Open the project graph in the browser.

### port

Bind the project graph server to a specific port.

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

### watch

Default: `false`

Watch for changes to project graph and update in-browser

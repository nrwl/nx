---
title: 'affected:graph - CLI command'
description: 'Graph dependencies affected by changes. Alias: affected:dep-graph'
---

# affected:graph

Graph dependencies affected by changes. Alias: affected:dep-graph

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

_boolean_

All projects

### base

_string_

Base of the current branch (usually main)

### configuration

_string_

This is the configuration to use when performing tasks on projects

### exclude

_array_

Default:

Exclude certain projects from being processed

### file

_string_

Output file (e.g. --file=output.json or --file=dep-graph.html)

### files

_array_

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas

### focus

_string_

Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.

### groupByFolder

_boolean_

Group projects by folder in the project graph

### head

_string_

Latest commit of the current branch (usually HEAD)

### help

_boolean_

Show help

### host

_string_

Bind the project graph server to a specific ip address.

### ~~only-failed~~

_boolean_

Default: false

**Deprecated:** The command to rerun failed projects will appear if projects fail. This now does nothing and will be removed in v15.

Isolate projects which previously failed

### open

_boolean_

Default: true

Open the project graph in the browser.

### port

_number_

Bind the project graph server to a specific port.

### runner

_string_

This is the name of the tasks runner configured in nx.json

### skip-nx-cache

_boolean_

Default: false

Rerun the tasks even when the results are available in the cache

### uncommitted

_boolean_

Uncommitted changes

### untracked

_boolean_

Untracked changes

### verbose

Print additional error stack trace on failure

### version

_boolean_

Show version number

### watch

_boolean_

Default: false

Watch for changes to project graph and update in-browser

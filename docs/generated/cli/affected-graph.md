---
title: 'affected:graph - CLI command'
description: 'Graph dependencies affected by changes'
---

# affected:graph

**Deprecated:** Use `nx graph --affected`, or` nx affected --graph` instead depending on which best suits your use case. The `affected:graph` command will be removed in Nx 18.

Graph dependencies affected by changes

## Usage

```shell
nx affected:graph
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Open the project graph of the workspace in the browser, and highlight the projects affected by changing the index.ts file:

```shell
 nx affected:graph --files=libs/mylib/src/index.ts
```

Open the project graph of the workspace in the browser, and highlight the projects affected by the changes between main and HEAD (e.g., PR):

```shell
 nx affected:graph --base=main --head=HEAD
```

Save the project graph of the workspace in a json file, and highlight the projects affected by the changes between main and HEAD (e.g., PR):

```shell
 nx affected:graph --base=main --head=HEAD --file=output.json
```

Generate a static website with project graph data in an html file, highlighting the projects affected by the changes between main and HEAD (e.g., PR):

```shell
 nx affected:graph --base=main --head=HEAD --file=output.html
```

Open the project graph of the workspace in the browser, and highlight the projects affected by the last commit on main:

```shell
 nx affected:graph --base=main~1 --head=main
```

Open the project graph of the workspace in the browser, highlight the projects affected, but exclude project-one and project-two:

```shell
 nx affected:graph --exclude=project-one,project-two
```

## Options

### base

Type: `string`

Base of the current branch (usually main)

### exclude

Type: `string`

Exclude certain projects from being processed

### file

Type: `string`

Output file (e.g. --file=output.json or --file=dep-graph.html)

### files

Type: `string`

Change the way Nx is calculating the affected command by providing directly changed files, list of files delimited by commas or spaces

### focus

Type: `string`

Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.

### groupByFolder

Type: `boolean`

Group projects by folder in the project graph

### head

Type: `string`

Latest commit of the current branch (usually HEAD)

### help

Type: `boolean`

Show help

### host

Type: `string`

Bind the project graph server to a specific ip address.

### open

Type: `boolean`

Default: `true`

Open the project graph in the browser.

### port

Type: `number`

Bind the project graph server to a specific port.

### targets

Type: `string`

The target to show tasks for in the task graph

### uncommitted

Type: `boolean`

Uncommitted changes

### untracked

Type: `boolean`

Untracked changes

### version

Type: `boolean`

Show version number

### view

Type: `string`

Choices: [projects, tasks]

Default: `projects`

Choose whether to view the projects or task graph

### watch

Type: `boolean`

Default: `false`

Watch for changes to project graph and update in-browser

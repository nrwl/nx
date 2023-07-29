---
title: 'graph - CLI command'
description: 'Graph dependencies within workspace'
---

# graph

Graph dependencies within workspace

## Usage

```shell
nx graph
```

Install `nx` globally to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpm nx`.

### Examples

Open the project graph of the workspace in the browser:

```shell
 nx graph
```

Save the project graph into a json file:

```shell
 nx graph --file=output.json
```

Generate a static website with project graph into an html file, accompanied by an asset folder called static:

```shell
 nx graph --file=output.html
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main:

```shell
 nx graph --focus=todos-feature-main
```

Include project-one and project-two in the project graph:

```shell
 nx graph --include=project-one,project-two
```

Exclude project-one and project-two from the project graph:

```shell
 nx graph --exclude=project-one,project-two
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two:

```shell
 nx graph --focus=todos-feature-main --exclude=project-one,project-two
```

Watch for changes to project graph and update in-browser:

```shell
 nx graph --watch
```

## Options

### affected

Type: `boolean`

Highlight affected projects

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

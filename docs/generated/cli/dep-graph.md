---
title: 'dep-graph - CLI command'
description: 'Graph dependencies within workspace'
---

# dep-graph

Graph dependencies within workspace

## Usage

```bash
nx dep-graph
```

[Install `nx` globally](/getting-started/nx-setup#install-nx) to invoke the command directly using `nx`, or use `npx nx`, `yarn nx`, or `pnpx nx`.

### Examples

Open the project graph of the workspace in the browser:

```bash
nx graph
```

Save the project graph into a json file:

```bash
nx graph --file=output.json
```

Generate a static website with project graph into an html file, accompanied by an asset folder called static:

```bash
nx graph --file=output.html
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main:

```bash
nx graph --focus=todos-feature-main
```

Include project-one and project-two in the project graph:

```bash
nx graph --include=project-one,project-two
```

Exclude project-one and project-two from the project graph:

```bash
nx graph --exclude=project-one,project-two
```

Show the graph where every node is either an ancestor or a descendant of todos-feature-main, but exclude project-one and project-two:

```bash
nx graph --focus=todos-feature-main --exclude=project-one,project-two
```

Watch for changes to project graph and update in-browser:

```bash
nx graph --watch
```

## Options

### exclude

List of projects delimited by commas to exclude from the project graph.

### file

Output file (e.g. --file=output.json or --file=dep-graph.html)

### focus

Use to show the project graph for a particular project and every node that is either an ancestor or a descendant.

### groupByFolder

Group projects by folder in the project graph

### help

Show help

### host

Bind the project graph server to a specific ip address.

### open

Default: `true`

Open the project graph in the browser.

### port

Bind the project graph server to a specific port.

### version

Show version number

### watch

Default: `false`

Watch for changes to project graph and update in-browser
